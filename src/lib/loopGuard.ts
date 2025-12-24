import { DecisionOutcome, DecisionOutcomeType, halted } from "./decisionOutcome";

const OUTCOME_TYPES: DecisionOutcomeType[] = [
  "executed",
  "deferred",
  "declined",
  "transformed",
  "expired",
  "halted",
];
const LEGACY_OUTCOME_TYPES = ["DONE", "BLOCKED", "DEFERRED", "RETRY", "ESCALATE", "CANCELLED"] as const;
const NEXT_ACTION_KINDS = ["ASK_USER", "REQUEST_APPROVAL", "RUN_NEXT", "SCHEDULE"];

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const isDecisionOutcome = (value: unknown): value is DecisionOutcome => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as DecisionOutcome;
  if (!OUTCOME_TYPES.includes(candidate.type)) return false;
  if (!isNonEmptyString(candidate.summary)) return false;

  if (candidate.details && typeof candidate.details !== "object") return false;

  if (candidate.nextAction) {
    if (typeof candidate.nextAction !== "object") return false;
    const nextAction = candidate.nextAction as DecisionOutcome["nextAction"];
    if (!nextAction?.kind || !NEXT_ACTION_KINDS.includes(nextAction.kind)) return false;
  }

  return true;
};

const normalizeLegacyOutcome = (value: unknown): DecisionOutcome | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { type?: string; summary?: unknown; details?: unknown; nextAction?: unknown };
  if (!candidate.type || !LEGACY_OUTCOME_TYPES.includes(candidate.type as (typeof LEGACY_OUTCOME_TYPES)[number])) return null;

  const legacyType = candidate.type;
  const mappedType: DecisionOutcomeType =
    legacyType === "DONE"
      ? "executed"
      : legacyType === "BLOCKED"
        ? "halted"
        : legacyType === "DEFERRED"
          ? "deferred"
          : legacyType === "RETRY"
            ? "deferred"
            : legacyType === "ESCALATE"
              ? "halted"
              : "declined";

  const summary = isNonEmptyString(candidate.summary) ? candidate.summary : mappedType;
  const details = candidate.details && typeof candidate.details === "object" ? (candidate.details as Record<string, unknown>) : undefined;
  let nextAction: DecisionOutcome["nextAction"];
  if (candidate.nextAction && typeof candidate.nextAction === "object") {
    const nextActionCandidate = candidate.nextAction as DecisionOutcome["nextAction"];
    if (nextActionCandidate?.kind && NEXT_ACTION_KINDS.includes(nextActionCandidate.kind)) {
      nextAction = nextActionCandidate;
    }
  }

  return { type: mappedType, summary, details, nextAction };
};

const describeType = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

const getObjectKeys = (value: unknown): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>);
};

export const ensureOutcome = (value: unknown, fallbackSummary: string): DecisionOutcome => {
  if (isDecisionOutcome(value)) return value;
  const normalizedLegacy = normalizeLegacyOutcome(value);
  if (normalizedLegacy) return normalizedLegacy;
  return halted(fallbackSummary || "INVALID_OUTCOME", {
    receivedType: describeType(value),
    receivedKeys: getObjectKeys(value),
  });
};

export const requireFields = <T>(
  value: T,
  fields: string[]
):
  | { ok: true; value: T }
  | { ok: false; outcome: DecisionOutcome } => {
  if (!value || typeof value !== "object") {
    return {
      ok: false,
      outcome: halted("MISSING_FIELDS", {
        missing: fields.slice(),
        receivedType: describeType(value),
      }),
    };
  }

  const missing = fields.filter((field) => (value as Record<string, unknown>)[field] == null);
  if (missing.length > 0) {
    return {
      ok: false,
      outcome: halted("MISSING_FIELDS", { missing }),
    };
  }

  return { ok: true, value };
};
