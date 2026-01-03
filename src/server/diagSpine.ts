export type ErrorClass = "ENV" | "AUTH" | "DB" | "ROUTE" | "NETWORK" | "CODE" | "UNKNOWN";

export type CheckStatus = "PASS" | "FAIL";

export type CheckRecord = {
  name: string;
  status: CheckStatus;
  detail: string;
  classification?: ErrorClass;
  evidence?: Record<string, unknown>;
};

export type ErrorRecord = {
  name: string;
  classification: ErrorClass;
  detail: string;
  evidence?: Record<string, unknown>;
};

export type DiagReport = {
  ok: boolean;
  timestamp: string;
  correlation_id: string;
  env: {
    present: {
      SUPABASE_URL: boolean;
      SUPABASE_SERVICE_ROLE_KEY: boolean;
      SUPABASE_ANON_KEY: boolean;
    };
    sanity: {
      SUPABASE_URL: { ok: boolean; detail: string };
      SUPABASE_SERVICE_ROLE_KEY: { ok: boolean; detail: string };
      SUPABASE_ANON_KEY: { ok: boolean; detail: string };
    };
  };
  checks: CheckRecord[];
  errors: ErrorRecord[];
};

type EnvReport = {
  present: DiagReport["env"]["present"];
  sanity: DiagReport["env"]["sanity"];
  trimmed: {
    supabaseUrl: string;
    serviceRoleKey: string;
    anonKey: string;
  };
};

type BuildOptions = {
  env: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  apiRoutes: string[];
  correlationId?: string;
  timestamp?: string;
};

const REQUIRED_TABLES = ["visitors", "analytics_events", "user_consent", "chat_messages", "leads", "events"] as const;
const VISITOR_COLUMNS_PRIMARY = [
  "visitor_id",
  "created_at",
  "updated_at",
  "user_agent",
  "first_seen_at",
  "last_seen_at",
] as const;
const VISITOR_COLUMNS_FALLBACK = [
  "visitor_id",
  "created_at",
  "updated_at",
  "browser_header",
  "first_seen_at",
  "last_seen_at",
] as const;

const ROUTE_TIMEOUT_MS = 8000;
const DB_TIMEOUT_MS = 8000;
const MAX_BODY = 1200;

const createUuid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const truncate = (raw: string) => (raw.length > MAX_BODY ? `${raw.slice(0, MAX_BODY)}...` : raw);

const parseJson = (raw: string) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeCommaHeader = (value: string | null) => {
  if (!value) return null;
  const [first] = value.split(",").map((item) => item.trim());
  return first || null;
};

const extractHeaderValue = (value: string | string[] | undefined) => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

const resolveBaseUrl = (headers?: Record<string, string | string[] | undefined>) => {
  if (!headers) return null;
  const forwardedProto = normalizeCommaHeader(extractHeaderValue(headers["x-forwarded-proto"]));
  const forwardedHost = normalizeCommaHeader(extractHeaderValue(headers["x-forwarded-host"]));
  const host = normalizeCommaHeader(extractHeaderValue(headers.host));
  const proto = forwardedProto ?? "http";
  const baseHost = forwardedHost ?? host ?? null;
  if (!baseHost) return null;
  return `${proto}://${baseHost}`;
};

const getTimeoutSignal = (timeoutMs: number) => {
  if (!("AbortSignal" in globalThis) || !("timeout" in AbortSignal)) return undefined;
  return AbortSignal.timeout(timeoutMs);
};

export const classifyError = (input: unknown): ErrorClass => {
  const message =
    input instanceof Error
      ? input.message
      : typeof input === "string"
        ? input
        : input
          ? JSON.stringify(input)
          : "";
  const lowered = message.toLowerCase();
  if (!lowered) return "UNKNOWN";
  if (lowered.includes("missing_env") || lowered.includes("supabase_url") || lowered.includes("env")) return "ENV";
  if (lowered.includes("401") || lowered.includes("403") || lowered.includes("auth") || lowered.includes("jwt"))
    return "AUTH";
  if (lowered.includes("schema") || lowered.includes("table") || lowered.includes("column") || lowered.includes("pgrst"))
    return "DB";
  if (lowered.includes("route") || lowered.includes("non_json") || lowered.includes("redirect")) return "ROUTE";
  if (lowered.includes("fetch") || lowered.includes("network") || lowered.includes("enotfound") || lowered.includes("timeout"))
    return "NETWORK";
  if (lowered.includes("syntax") || lowered.includes("unexpected token")) return "CODE";
  return "UNKNOWN";
};

const hasWhitespace = (value: string) => /[\s\u00A0\u200B]/.test(value);
const looksLikeUrl = (value: string) => /^https?:\/\//i.test(value);
const looksLikeJwt = (value: string) => value.startsWith("eyJ") && value.length >= 40;

const looksLikeSupabaseHost = (value: string) => {
  try {
    const url = new URL(value);
    return /^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname);
  } catch {
    return false;
  }
};

export const buildEnvReport = (env: Record<string, string | undefined>): EnvReport => {
  const present = {
    SUPABASE_URL: Boolean(env.SUPABASE_URL?.trim()),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    SUPABASE_ANON_KEY: Boolean(env.SUPABASE_ANON_KEY?.trim()),
  };

  const urlRaw = env.SUPABASE_URL ?? "";
  const urlTrimmed = urlRaw.trim();
  let urlOk = true;
  let urlDetail = "ok";
  if (!urlTrimmed) {
    urlOk = false;
    urlDetail = "missing";
  } else if (urlRaw !== urlTrimmed || hasWhitespace(urlTrimmed)) {
    urlOk = false;
    urlDetail = "whitespace";
  } else if (urlTrimmed.endsWith("/")) {
    urlOk = false;
    urlDetail = "trailing_slash";
  } else if (!looksLikeUrl(urlTrimmed)) {
    urlOk = false;
    urlDetail = "not_url";
  } else if (!looksLikeSupabaseHost(urlTrimmed)) {
    urlOk = false;
    urlDetail = "unexpected_host";
  }

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  let serviceOk = true;
  let serviceDetail = "ok";
  if (!serviceKey) {
    serviceOk = false;
    serviceDetail = "missing";
  } else if (!looksLikeJwt(serviceKey)) {
    serviceOk = false;
    serviceDetail = "format";
  }

  const anonKey = env.SUPABASE_ANON_KEY?.trim() ?? "";
  let anonOk = true;
  let anonDetail = "ok";
  if (!anonKey) {
    anonOk = false;
    anonDetail = "missing";
  } else if (!looksLikeJwt(anonKey)) {
    anonOk = false;
    anonDetail = "format";
  }

  return {
    present,
    sanity: {
      SUPABASE_URL: { ok: urlOk, detail: urlDetail },
      SUPABASE_SERVICE_ROLE_KEY: { ok: serviceOk, detail: serviceDetail },
      SUPABASE_ANON_KEY: { ok: anonOk, detail: anonDetail },
    },
    trimmed: {
      supabaseUrl: urlTrimmed,
      serviceRoleKey: serviceKey,
      anonKey,
    },
  };
};

const buildRestHeaders = (serviceRoleKey: string) => ({
  "Content-Type": "application/json",
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
});

const stripQueryRoute = (route: string) => route.split("?")[0];

const normalizeRoutePath = (route: string) => {
  if (route.includes("[id]")) return route.replace("[id]", "diag");
  return route;
};

export const buildDiagReport = async (options: BuildOptions): Promise<DiagReport> => {
  const correlationId = options.correlationId ?? createUuid();
  const timestamp = options.timestamp ?? new Date().toISOString();
  const envReport = buildEnvReport(options.env);
  const checks: CheckRecord[] = [];
  const errors: ErrorRecord[] = [];

  const addCheck = (
    name: string,
    ok: boolean,
    detail: string,
    evidence: Record<string, unknown> | undefined,
    classification?: ErrorClass
  ) => {
    const status: CheckStatus = ok ? "PASS" : "FAIL";
    const failureClass = ok ? undefined : classification ?? classifyError(detail);
    checks.push({ name, status, detail, classification: failureClass, evidence });
    if (!ok) {
      errors.push({
        name,
        classification: failureClass ?? "UNKNOWN",
        detail,
        evidence,
      });
    }
  };

  const requiredEnvOk =
    envReport.present.SUPABASE_URL &&
    envReport.present.SUPABASE_SERVICE_ROLE_KEY &&
    envReport.sanity.SUPABASE_URL.ok &&
    envReport.sanity.SUPABASE_SERVICE_ROLE_KEY.ok;

  addCheck(
    "env.sanity",
    requiredEnvOk,
    requiredEnvOk ? "required env present" : "missing_or_invalid_env",
    { present: envReport.present, sanity: envReport.sanity },
    "ENV"
  );

  const baseUrl = resolveBaseUrl(options.headers);
  if (!baseUrl) {
    addCheck("routes.base_url", false, "base_url_missing", undefined, "ROUTE");
  } else {
    const routesToCheck = options.apiRoutes.map(normalizeRoutePath).filter((route) => {
      const normalized = stripQueryRoute(route);
      return normalized !== "/api/diag";
    });

    for (const path of routesToCheck) {
      const url = `${baseUrl}${path}`;
      try {
        const response = await fetch(url, {
          method: "GET",
          redirect: "manual",
          signal: getTimeoutSignal(ROUTE_TIMEOUT_MS),
        });
        const contentType = response.headers.get("content-type") ?? "";
        const location = response.headers.get("location") ?? null;
        const raw = await response.text();
        const parsed = parseJson(raw);
        const isJson = contentType.toLowerCase().includes("application/json") || parsed !== null;
        const redirected = response.status >= 300 && response.status < 400;
        const ok = isJson && !redirected;
        addCheck(
          `route:${path}`,
          ok,
          ok ? `status:${response.status}` : "non_json_or_redirect",
          {
            status: response.status,
            contentType,
            redirected,
            location,
            bodyPreview: ok ? null : truncate(raw),
          },
          "ROUTE"
        );
      } catch (error) {
        addCheck(
          `route:${path}`,
          false,
          error instanceof Error ? error.message : "route_fetch_failed",
          undefined,
          "ROUTE"
        );
      }
    }
  }

  const supabaseUrl = envReport.trimmed.supabaseUrl;
  const serviceRoleKey = envReport.trimmed.serviceRoleKey;
  const supabaseReady = requiredEnvOk;

  if (!supabaseReady) {
    addCheck("db.connectivity", false, "missing_env", undefined, "ENV");
  } else {
    try {
      const url = `${supabaseUrl}/rest/v1/events?select=id&limit=1`;
      const response = await fetch(url, {
        method: "GET",
        headers: buildRestHeaders(serviceRoleKey),
        signal: getTimeoutSignal(DB_TIMEOUT_MS),
      });
      const raw = await response.text();
      if (!response.ok) {
        const classification = response.status === 401 || response.status === 403 ? "AUTH" : "DB";
        addCheck(
          "db.connectivity",
          false,
          `status:${response.status}`,
          { bodyPreview: truncate(raw) },
          classification
        );
      } else {
        addCheck("db.connectivity", true, "ok", undefined, undefined);
      }
    } catch (error) {
      addCheck(
        "db.connectivity",
        false,
        error instanceof Error ? error.message : "fetch_failed",
        undefined,
        "NETWORK"
      );
    }
  }

  for (const table of REQUIRED_TABLES) {
    if (!supabaseReady) {
      addCheck(`schema:${table}`, false, "missing_env", undefined, "ENV");
      continue;
    }
    try {
      const url = `${supabaseUrl}/rest/v1/${table}?select=*&limit=1`;
      const response = await fetch(url, {
        method: "GET",
        headers: buildRestHeaders(serviceRoleKey),
        signal: getTimeoutSignal(DB_TIMEOUT_MS),
      });
      const raw = await response.text();
      if (!response.ok) {
        addCheck(`schema:${table}`, false, `status:${response.status}`, { bodyPreview: truncate(raw) }, "DB");
      } else {
        addCheck(`schema:${table}`, true, "ok", undefined, undefined);
      }
    } catch (error) {
      addCheck(
        `schema:${table}`,
        false,
        error instanceof Error ? error.message : "fetch_failed",
        undefined,
        "NETWORK"
      );
    }
  }

  if (!supabaseReady) {
    addCheck("schema:visitors.columns", false, "missing_env", undefined, "ENV");
  } else {
    const attemptColumns = async (columns: readonly string[]) => {
      const select = columns.join(",");
      const url = `${supabaseUrl}/rest/v1/visitors?select=${select}&limit=1`;
      const response = await fetch(url, {
        method: "GET",
        headers: buildRestHeaders(serviceRoleKey),
        signal: getTimeoutSignal(DB_TIMEOUT_MS),
      });
      const raw = await response.text();
      return { response, raw };
    };

    try {
      const primary = await attemptColumns(VISITOR_COLUMNS_PRIMARY);
      if (primary.response.ok) {
        addCheck("schema:visitors.columns", true, "ok", { columns: VISITOR_COLUMNS_PRIMARY }, undefined);
      } else {
        const fallback = await attemptColumns(VISITOR_COLUMNS_FALLBACK);
        if (fallback.response.ok) {
          addCheck("schema:visitors.columns", true, "fallback_browser_header", {
            columns: VISITOR_COLUMNS_FALLBACK,
          });
        } else {
          addCheck(
            "schema:visitors.columns",
            false,
            `status:${primary.response.status}`,
            { primary: truncate(primary.raw), fallback: truncate(fallback.raw) },
            "DB"
          );
        }
      }
    } catch (error) {
      addCheck(
        "schema:visitors.columns",
        false,
        error instanceof Error ? error.message : "fetch_failed",
        undefined,
        "NETWORK"
      );
    }
  }

  if (!supabaseReady) {
    addCheck("db.write_read", false, "missing_env", undefined, "ENV");
  } else {
    const insertPayload = {
      event_type: "diagnostic",
      actor_type: "system",
      subject_type: "diagnostic",
      payload: { correlation_id: correlationId, source: "diag" },
      trace_id: correlationId,
    };

    try {
      const insertUrl = `${supabaseUrl}/rest/v1/events`;
      const insertResponse = await fetch(insertUrl, {
        method: "POST",
        headers: { ...buildRestHeaders(serviceRoleKey), Prefer: "return=representation" },
        body: JSON.stringify(insertPayload),
        signal: getTimeoutSignal(DB_TIMEOUT_MS),
      });
      const insertRaw = await insertResponse.text();
      const insertParsed = parseJson(insertRaw);
      const insertedId =
        Array.isArray(insertParsed) && insertParsed.length > 0 ? (insertParsed[0] as { id?: string }).id : null;

      if (!insertResponse.ok || !insertedId) {
        addCheck(
          "db.write_read",
          false,
          `insert_status:${insertResponse.status}`,
          { bodyPreview: truncate(insertRaw) },
          insertResponse.status === 401 || insertResponse.status === 403 ? "AUTH" : "DB"
        );
      } else {
        const readUrl = `${supabaseUrl}/rest/v1/events?id=eq.${insertedId}&select=id,trace_id&limit=1`;
        const readResponse = await fetch(readUrl, {
          method: "GET",
          headers: buildRestHeaders(serviceRoleKey),
          signal: getTimeoutSignal(DB_TIMEOUT_MS),
        });
        const readRaw = await readResponse.text();
        const readOk = readResponse.ok;
        let cleanupOk: boolean | null = null;
        try {
          const deleteUrl = `${supabaseUrl}/rest/v1/events?id=eq.${insertedId}`;
          const deleteResponse = await fetch(deleteUrl, {
            method: "DELETE",
            headers: buildRestHeaders(serviceRoleKey),
            signal: getTimeoutSignal(DB_TIMEOUT_MS),
          });
          cleanupOk = deleteResponse.ok;
        } catch {
          cleanupOk = null;
        }

        addCheck(
          "db.write_read",
          readOk,
          readOk ? "insert_read_ok" : `read_status:${readResponse.status}`,
          {
            inserted_id: insertedId,
            readPreview: readOk ? null : truncate(readRaw),
            cleanup_ok: cleanupOk,
          },
          readOk ? undefined : "DB"
        );
      }
    } catch (error) {
      addCheck(
        "db.write_read",
        false,
        error instanceof Error ? error.message : "fetch_failed",
        undefined,
        "NETWORK"
      );
    }
  }

  const ok = errors.length === 0;

  return {
    ok,
    timestamp,
    correlation_id: correlationId,
    env: { present: envReport.present, sanity: envReport.sanity },
    checks,
    errors,
  };
};
