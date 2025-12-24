import type { DecisionOutcome } from "@/lib/decisionOutcome";

export type TrustLevel = 0 | 1 | 2 | 3 | 4;

export type Intent = {
  intent_id: string;
  intent_type: string;
  intent_reason: string;
  expected_metric: string;
};

export type ActionSpec = {
  action_type: string;
  params: Record<string, unknown>;
  irreversible_level: number;
  requires_confirmation: boolean;
  cooldown_ms: number;
};

export type PreflightDecision = "ALLOW" | "BLOCK" | "ALLOW_WITH_FRICTION";

export type PreflightResult = {
  decision: PreflightDecision;
  reasons: string[];
  frictionSteps: string[];
};

export type LedgerEntry = {
  timestamp: string;
  identity: string;
  intent: Intent;
  actionSpec: ActionSpec;
  preflight: PreflightResult;
  outcome: DecisionOutcome;
  evidenceRefs: string[];
  rollbackHint?: string;
};

export type EnvPresence = {
  isMockMode: boolean;
  missingRequired: string[];
  missingOptional?: string[];
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const LEDGER_PREFIX = "ppp:spineLedger:v1::";
const CLOCK_PREFIX = "ppp:spineLedgerClock:v1::";
const TRUST_PREFIX = "ppp:spineTrustLevel:v1::";
const DEFAULT_COOLDOWN_MS = 60_000;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage;
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  return null;
};

const normalizeTrustLevel = (value: unknown): TrustLevel => {
  const parsed = Number.isFinite(value as number) ? Number(value) : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return 1;
  return clamp(parsed, 0, 4) as TrustLevel;
};

const isDefaultIntent = (intent: Intent) =>
  intent.intent_type === "default" || intent.intent_id === "default" || intent.intent_reason === "default";

const validateIntent = (intent: Intent | null | undefined): string[] => {
  if (!intent) return ["intent_missing"];
  const missing = [];
  if (!isNonEmptyString(intent.intent_id)) missing.push("intent_id");
  if (!isNonEmptyString(intent.intent_type)) missing.push("intent_type");
  if (!isNonEmptyString(intent.intent_reason)) missing.push("intent_reason");
  if (!isNonEmptyString(intent.expected_metric)) missing.push("expected_metric");
  return missing;
};

const normalizeActionSpec = (actionSpec: ActionSpec): ActionSpec => ({
  action_type: actionSpec.action_type,
  params: actionSpec.params ?? {},
  irreversible_level: clamp(Math.floor(actionSpec.irreversible_level ?? 0), 0, 4),
  requires_confirmation: Boolean(actionSpec.requires_confirmation),
  cooldown_ms: Math.max(0, Math.floor(actionSpec.cooldown_ms ?? 0)),
});

const getLedgerKey = (identity: string) => `${LEDGER_PREFIX}${identity}`;
const getClockKey = (identity: string) => `${CLOCK_PREFIX}${identity}`;

const loadLedger = (identity: string, storage?: StorageLike): LedgerEntry[] => {
  const resolved = resolveStorage(storage);
  if (!resolved) return [];
  try {
    const raw = resolved.getItem(getLedgerKey(identity));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LedgerEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const nextTimestamp = (identity: string, storage?: StorageLike): string => {
  const resolved = resolveStorage(storage);
  if (!resolved) return "s0";
  const raw = resolved.getItem(getClockKey(identity));
  const current = Number.parseInt(String(raw ?? ""), 10);
  const nextValue = Number.isFinite(current) ? current + 1 : 1;
  resolved.setItem(getClockKey(identity), String(nextValue));
  return `s${nextValue}`;
};

export const computeIdentityKey = (userId?: string | null, email?: string | null) =>
  userId || email || "anonymous";

export const getTrustLevel = (
  identity: string,
  options?: { mockMode?: boolean; storage?: StorageLike }
): TrustLevel => {
  if (options?.mockMode) return 4;
  const resolved = resolveStorage(options?.storage);
  if (!resolved) return 1;
  return normalizeTrustLevel(resolved.getItem(`${TRUST_PREFIX}${identity}`));
};

export const policyPreflight = (
  intent: Intent,
  actionSpec: ActionSpec,
  trustLevel: TrustLevel,
  envPresence: EnvPresence
): PreflightResult => {
  const normalizedAction = normalizeActionSpec(actionSpec);
  const reasons: string[] = [];
  const frictionSteps: string[] = [];

  const missingIntent = validateIntent(intent);
  if (missingIntent.length > 0) {
    reasons.push(`intent_missing:${missingIntent.join(",")}`);
  }

  if (isDefaultIntent(intent) && !envPresence.isMockMode) {
    reasons.push("default_intent_not_allowed");
  }

  if (!envPresence.isMockMode && envPresence.missingRequired.length > 0) {
    for (const key of envPresence.missingRequired) {
      reasons.push(`missing_env:${key}`);
    }
  }

  const requiredTrust =
    normalizedAction.irreversible_level > 0 ? clamp(Math.max(2, normalizedAction.irreversible_level), 0, 4) : 0;
  if (normalizedAction.irreversible_level > 0 && trustLevel < requiredTrust) {
    reasons.push("insufficient_trust");
  }

  const requiresFriction =
    normalizedAction.requires_confirmation ||
    normalizedAction.cooldown_ms > 0 ||
    normalizedAction.irreversible_level > 0;
  if (requiresFriction) {
    frictionSteps.push("confirm_token");
    const cooldown = normalizedAction.cooldown_ms > 0 ? normalizedAction.cooldown_ms : DEFAULT_COOLDOWN_MS;
    frictionSteps.push(`cooldown_ms:${cooldown}`);
  }

  const decision: PreflightDecision =
    reasons.length > 0 ? "BLOCK" : frictionSteps.length > 0 ? "ALLOW_WITH_FRICTION" : "ALLOW";

  return {
    decision,
    reasons,
    frictionSteps,
  };
};

export const appendLedger = (entry: LedgerEntry, options?: { storage?: StorageLike }): LedgerEntry[] => {
  const identity = entry.identity;
  const timestamp = isNonEmptyString(entry.timestamp) ? entry.timestamp : nextTimestamp(identity, options?.storage);
  const nextEntry: LedgerEntry = { ...entry, timestamp };
  const existing = loadLedger(identity, options?.storage);
  const next = [...existing, nextEntry];
  const resolved = resolveStorage(options?.storage);
  if (resolved) {
    resolved.setItem(getLedgerKey(identity), JSON.stringify(next));
  }
  return next;
};
