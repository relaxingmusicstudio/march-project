import { jsonErr, jsonOk } from "../src/kernel/apiJson.js";
import { DEFAULT_DOMAINS } from "../apps/search-pilot/src/core/domains.js";
import { runSearch } from "../apps/search-pilot/src/core/engine.js";
import { recordDecision } from "../src/lib/decisionStore.js";
import type { Decision } from "../src/kernel/decisionContract.js";
import { buildNoopPayload, getKernelLockState } from "../src/kernel/governanceGate.js";
import { DecisionGuardrailError, validateDecisionInput } from "../src/lib/decisionRuntimeGuardrails.js";
import { calibrateDecision, getCalibrationGate } from "../src/lib/metaCalibration.js";

export const config = { runtime: "nodejs" };

type ApiRequest = AsyncIterable<Uint8Array | string> & {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
type RequiredEnvKey = (typeof REQUIRED_ENV)[number];

type SearchPayload = {
  query?: unknown;
  domains?: unknown;
  mode?: unknown;
};

const setCorsHeaders = (res: ApiResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
};

const sendJson = (res: ApiResponse, status: number, payload: Record<string, unknown>) => {
  setCorsHeaders(res);
  const isError = payload.ok === false || status >= 400;
  if (isError) {
    const errorCode =
      (typeof payload.errorCode === "string" && payload.errorCode) ||
      (typeof payload.code === "string" && payload.code) ||
      "error";
    const message =
      (typeof payload.error === "string" && payload.error) ||
      (typeof payload.message === "string" && payload.message) ||
      "error";
    jsonErr(res, status, errorCode, message, payload);
    return;
  }
  jsonOk(res, payload);
};

const stripEnvValue = (value: string | undefined) => value?.trim().replace(/^"|"$|^'|'$/g, "");

const normalizeSupabaseUrl = (url: string) => (url.endsWith("/") ? url.slice(0, -1) : url);

const parseHost = (value: string) => {
  try {
    return new URL(value).host;
  } catch {
    return "unknown";
  }
};

const isValidSupabaseUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.host);
  } catch {
    return false;
  }
};

const getEnvStatus = () => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const present = REQUIRED_ENV.reduce<Record<RequiredEnvKey, boolean>>((acc, key) => {
    acc[key] = Boolean(env?.[key]);
    return acc;
  }, {} as Record<RequiredEnvKey, boolean>);
  const missing = REQUIRED_ENV.filter((key) => !env?.[key]);
  return { env, present, missing };
};

const readJsonBody = async (req: ApiRequest) => {
  if (req?.body && typeof req.body === "object") {
    return req.body;
  }
  let raw = "";
  for await (const chunk of req) {
    if (typeof chunk === "string") {
      raw += chunk;
      continue;
    }
    raw += new TextDecoder().decode(chunk);
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const mapDecisionStatusToDb = (status: Decision["status"]) => (status === "failed" ? "cancelled" : "pending");

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const { env, present, missing } = getEnvStatus();

  if (req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      status: "ok",
      method: "GET",
      expected_methods: ["POST"],
      message: "Use POST with { query } to resolve a decision.",
      allowed_domains: DEFAULT_DOMAINS,
      env_present: present,
    });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, code: "method_not_allowed", error: "Method not allowed" });
    return;
  }

  const body = (await readJsonBody(req)) as SearchPayload | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const domainsInput = body?.domains;
  const inputValidation = validateDecisionInput(
    { query, domains: domainsInput },
    { source: "api/search-decision", allowedDomains: DEFAULT_DOMAINS }
  );
  if (!inputValidation.ok) {
    const codes = new Set(inputValidation.violations.map((violation) => violation.code));
    if (codes.has("query_required")) {
      sendJson(res, 400, { ok: false, code: "bad_request", error: "query is required" });
      return;
    }
    if (codes.has("domains_not_allowed")) {
      sendJson(res, 400, {
        ok: false,
        code: "bad_request",
        error: "domains must be one of the allowed domain ids",
        allowed_domains: DEFAULT_DOMAINS,
      });
      return;
    }
    sendJson(res, 400, { ok: false, code: "bad_request", error: "domains must be an array of strings" });
    return;
  }

  const domains = Array.isArray(domainsInput) ? (domainsInput as string[]) : undefined;

  const mode = body?.mode === "live" ? "live" : "mock";

  let response: Awaited<ReturnType<typeof runSearch>>;
  try {
    response = await runSearch(query, {
      domains: domains as (typeof DEFAULT_DOMAINS)[number][] | undefined,
      mode,
      latencyMs: 0,
    });
  } catch (error) {
    if (error instanceof DecisionGuardrailError) {
      const status = error.kind === "input" ? 400 : 500;
      sendJson(res, status, {
        ok: false,
        code: "decision_guardrail_failed",
        error: error.message,
      });
      return;
    }
    sendJson(res, 500, { ok: false, code: "decision_failed", error: "decision runtime error" });
    return;
  }

  const calibration =
    (response.decision as Decision & { calibration?: ReturnType<typeof calibrateDecision> }).calibration ??
    calibrateDecision({
      decision: response.decision as unknown as Record<string, unknown>,
      context: {
        evidence_summary: response.evidence_summary,
        domains: response.domains,
        intent: response.intent,
      },
      action: "suggest",
    });
  const calibratedDecision: Decision = { ...response.decision, calibration };
  response.decision = calibratedDecision;

  const gate = getCalibrationGate(calibration, "suggest");
  if (gate.noop) {
    sendJson(res, 200, {
      ok: true,
      status: 200,
      noop: true,
      reason_code: gate.reason_code,
      calibration,
      block_reason: calibration.block_reason,
      missing_evidence: calibration.missing_evidence,
      decision: calibratedDecision,
      evidence_summary: response.evidence_summary,
      intent: response.intent,
      domains: response.domains,
      explanation: response.explanation,
      analytics: response.analytics,
    });
    return;
  }

  const isProduction = env?.VERCEL_ENV === "production" || env?.NODE_ENV === "production";
  const lockState = getKernelLockState({ isProduction });
  if (lockState.locked) {
    sendJson(res, 200, {
      ...buildNoopPayload(lockState, "kernel_lock"),
      calibration,
      decision: calibratedDecision,
      evidence_summary: response.evidence_summary,
      intent: response.intent,
      domains: response.domains,
      explanation: response.explanation,
      analytics: response.analytics,
    });
    return;
  }

  recordDecision(calibratedDecision);

  const supabaseUrl = stripEnvValue(env?.SUPABASE_URL);
  const serviceRoleKey = stripEnvValue(env?.SUPABASE_SERVICE_ROLE_KEY);

  const allowSideEffects = calibration.confidence >= 0.75 && !calibration.block;
  if (allowSideEffects) {
    if (missing.length > 0 || !supabaseUrl || !serviceRoleKey) {
      sendJson(res, 500, {
        ok: false,
        code: "missing_env",
        error: "Supabase env missing",
        hint: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      });
      return;
    }

    if (!isValidSupabaseUrl(supabaseUrl)) {
      sendJson(res, 500, {
        ok: false,
        code: "missing_env",
        error: "Supabase URL invalid",
        hint: "SUPABASE_URL must be https://<project>.supabase.co",
      });
      return;
    }

    const baseUrl = normalizeSupabaseUrl(supabaseUrl);
    const host = parseHost(baseUrl);
    const insertUrl = `${baseUrl}/rest/v1/ceo_decisions?on_conflict=id&select=id`;
    const recordPayload = {
      id: calibratedDecision.decision_id,
      decision: calibratedDecision.recommendation,
      reasoning: calibratedDecision.reasoning,
      confidence: calibratedDecision.confidence,
      purpose: "search_decision",
      status: mapDecisionStatusToDb(calibratedDecision.status),
      context_snapshot: {
        query,
        input_hash: calibratedDecision.input_hash,
        assumptions: calibratedDecision.assumptions,
        decision_status: calibratedDecision.status,
        created_at: calibratedDecision.created_at,
        domains: response.domains,
        evidence_summary: response.evidence_summary,
      },
    };

    try {
      const responseWrite = await fetch(insertUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: "resolution=merge-duplicates, return=representation",
        },
        body: JSON.stringify(recordPayload),
      });

      if (!responseWrite.ok) {
        sendJson(res, 500, {
          ok: false,
          code: "upstream_error",
          error: "supabase_insert_failed",
          hint: `status:${responseWrite.status}`,
        });
        return;
      }
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        code: "upstream_error",
        error: error instanceof Error ? error.message : "supabase_insert_failed",
        hint: `host:${host}`,
      });
      return;
    }
  }

  sendJson(res, 200, {
    ok: true,
    decision: calibratedDecision,
    evidence_summary: response.evidence_summary,
    intent: response.intent,
    domains: response.domains,
    explanation: response.explanation,
    analytics: response.analytics,
    calibration,
  });
}
