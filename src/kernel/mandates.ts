import type { KernelIntent } from "@/kernel/run";
import type { RiskLevel } from "@/kernel/riskPolicy";

export type MandateScope = "external_effect";

export type MandateApproval = {
  approverId: string;
  approvedAt: string;
  role?: string;
};

export type MandatePayload = {
  mandateId: string;
  intent: KernelIntent;
  scope: MandateScope;
  issuedAt: string;
  expiresAt: string;
  riskLevel: RiskLevel;
  minApprovals: number;
  approvals: MandateApproval[];
  rationale: string;
};

export type MandateToken = {
  payload: MandatePayload;
  signature: string;
  alg: "HMAC-SHA256";
};

export type MandateValidation = {
  ok: boolean;
  code: string;
  detail?: string;
  approvals: {
    required: number;
    provided: number;
    unique: number;
  };
  signatureValid: boolean;
  expired: boolean;
};

type MandateValidationOptions = {
  expectedIntent?: KernelIntent;
  minApprovals?: number;
  minRiskLevel?: RiskLevel;
  secret?: string;
  now?: string;
};

const RISK_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const stableStringify = (value: unknown): string => {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const body = keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value);
};

const toBase64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  return binary;
};

const signHmac = async (payload: MandatePayload, secret: string): Promise<string | null> => {
  if (!globalThis.crypto?.subtle) return null;
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(stableStringify(payload))
  );
  return toBase64(new Uint8Array(signature));
};

const parseTime = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const uniqueApprovals = (approvals: MandateApproval[]) => {
  const unique = new Set<string>();
  approvals.forEach((approval) => {
    if (approval.approverId) unique.add(approval.approverId);
  });
  return unique;
};

export const requiredApprovalsForRisk = (level: RiskLevel): number =>
  level === "high" || level === "critical" ? 2 : 0;

export const signMandatePayload = async (payload: MandatePayload, secret: string) => {
  const signature = await signHmac(payload, secret);
  if (!signature) {
    return { ok: false, signature: "", error: "crypto_unavailable" };
  }
  return { ok: true, signature, error: null };
};

export const validateMandateToken = async (
  token: MandateToken | null | undefined,
  options: MandateValidationOptions = {}
): Promise<MandateValidation> => {
  const required = options.minApprovals ?? 0;
  const baseResult = {
    approvals: { required, provided: 0, unique: 0 },
    signatureValid: false,
    expired: false,
  };

  if (!token || !token.payload || typeof token.signature !== "string") {
    return { ok: false, code: "mandate_missing", ...baseResult };
  }

  const payload = token.payload;
  if (!payload.mandateId || !payload.intent || !payload.scope || !payload.issuedAt || !payload.expiresAt) {
    return { ok: false, code: "mandate_invalid", ...baseResult };
  }

  if (options.expectedIntent && payload.intent !== options.expectedIntent) {
    return { ok: false, code: "intent_mismatch", ...baseResult };
  }

  if (options.minRiskLevel) {
    const requiredRisk = RISK_ORDER[options.minRiskLevel];
    const payloadRisk = RISK_ORDER[payload.riskLevel];
    if (payloadRisk < requiredRisk) {
      return { ok: false, code: "risk_level_mismatch", ...baseResult };
    }
  }

  const issuedAt = parseTime(payload.issuedAt);
  const expiresAt = parseTime(payload.expiresAt);
  const now = parseTime(options.now) ?? Date.now();
  if (!issuedAt || !expiresAt) {
    return { ok: false, code: "mandate_time_invalid", ...baseResult };
  }
  if (expiresAt <= now) {
    return { ok: false, code: "mandate_expired", expired: true, ...baseResult };
  }

  const approvals = Array.isArray(payload.approvals) ? payload.approvals : [];
  const unique = uniqueApprovals(approvals);
  const approvalsCount = approvals.length;
  const uniqueCount = unique.size;
  const minApprovals = Math.max(required, payload.minApprovals ?? 0);
  const approvalsResult = {
    required: minApprovals,
    provided: approvalsCount,
    unique: uniqueCount,
  };
  if (uniqueCount < minApprovals) {
    return { ok: false, code: "approvals_insufficient", ...baseResult, approvals: approvalsResult };
  }

  if (!options.secret) {
    return { ok: false, code: "missing_secret", ...baseResult, approvals: approvalsResult };
  }

  const expectedSignature = await signHmac(payload, options.secret);
  if (!expectedSignature) {
    return { ok: false, code: "crypto_unavailable", ...baseResult, approvals: approvalsResult };
  }

  if (expectedSignature !== token.signature) {
    return { ok: false, code: "signature_invalid", ...baseResult, approvals: approvalsResult };
  }

  return {
    ok: true,
    code: "mandate_ok",
    approvals: approvalsResult,
    signatureValid: true,
    expired: false,
  };
};
