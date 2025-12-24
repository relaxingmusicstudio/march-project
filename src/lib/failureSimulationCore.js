export const FAILURE_CLASS = Object.freeze({
  GOVERNANCE_CONFLICT: "governance_conflict",
  DRIFT_ESCALATION: "drift_escalation",
  PROVIDER_COLLAPSE: "provider_collapse",
  TIME_DELAY: "time_delay",
  MALICIOUS_STEWARD: "malicious_steward",
});

export const DRIFT_ESCALATION_THRESHOLDS = Object.freeze({
  warning: 80,
  critical: 50,
});

const parseLogicalTime = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^f(\d+)$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const compareTime = (a, b) => {
  const parsedA = parseLogicalTime(a);
  const parsedB = parseLogicalTime(b);
  if (parsedA !== null && parsedB !== null) return parsedA - parsedB;
  return String(a).localeCompare(String(b));
};

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const normalizeFailureClass = (value) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (Object.values(FAILURE_CLASS).includes(normalized)) return normalized;
  throw new Error(`Invalid failure_class: ${value}`);
};

export const createFailureSimulationState = (seed = {}) => ({
  records: Array.isArray(seed.records) ? seed.records.slice() : [],
  logicalClock: Number.isFinite(seed.logicalClock) ? seed.logicalClock : 0,
});

export const advanceFailureClock = (state) => {
  const nextValue = Math.max(0, Number(state?.logicalClock ?? 0)) + 1;
  return { state: { ...state, logicalClock: nextValue }, value: `f${nextValue}` };
};

const ensureLogicalClock = (state, createdAt) => {
  const parsed = parseLogicalTime(createdAt);
  if (parsed === null) return state;
  if (parsed <= state.logicalClock) return state;
  return { ...state, logicalClock: parsed };
};

export const appendFailureRecord = (state, input) => {
  const failureClass = normalizeFailureClass(input?.failure_class);
  const status = isNonEmptyString(input?.status) ? input.status.trim() : "UNKNOWN";
  const reasons = Array.isArray(input?.reasons) ? input.reasons.map(String) : [];
  const context = input?.context && typeof input.context === "object" ? input.context : {};

  const baseState = createFailureSimulationState(state);
  let nextState = baseState;
  let createdAt = isNonEmptyString(input?.created_at) ? input.created_at.trim() : "";

  if (createdAt) {
    nextState = ensureLogicalClock(nextState, createdAt);
  } else {
    const advanced = advanceFailureClock(nextState);
    nextState = advanced.state;
    createdAt = advanced.value;
  }

  const recordId = isNonEmptyString(input?.record_id) ? input.record_id.trim() : `failure-${createdAt}`;
  const record = Object.freeze({
    record_id: recordId,
    failure_class: failureClass,
    status,
    safe_mode: input?.safe_mode === true,
    reasons: Object.freeze(reasons),
    context: Object.freeze({ ...context }),
    created_at: createdAt,
  });

  return {
    state: { ...nextState, records: [...nextState.records, record] },
    record,
  };
};

export const getFailureSimulationLedger = (records) =>
  (Array.isArray(records) ? records.slice() : [])
    .slice()
    .sort((a, b) => compareTime(a.created_at, b.created_at))
    .map((record) => Object.freeze({ ...record }));

export const evaluateDriftEscalation = (score, thresholds = DRIFT_ESCALATION_THRESHOLDS) => {
  const numeric = Number(score);
  const warning = Number.isFinite(thresholds?.warning) ? thresholds.warning : DRIFT_ESCALATION_THRESHOLDS.warning;
  const critical = Number.isFinite(thresholds?.critical) ? thresholds.critical : DRIFT_ESCALATION_THRESHOLDS.critical;

  if (!Number.isFinite(numeric)) {
    return Object.freeze({
      level: "UNKNOWN",
      requires_human_approval: true,
      auto_bypass_allowed: false,
      reason: "drift_score_missing",
    });
  }

  if (numeric < critical) {
    return Object.freeze({
      level: "CRITICAL",
      requires_human_approval: true,
      auto_bypass_allowed: false,
      reason: "drift_score_critical",
    });
  }

  if (numeric < warning) {
    return Object.freeze({
      level: "ADVISORY",
      requires_human_approval: false,
      auto_bypass_allowed: false,
      reason: "drift_score_warning",
    });
  }

  return Object.freeze({
    level: "OK",
    requires_human_approval: false,
    auto_bypass_allowed: false,
    reason: "drift_score_ok",
  });
};
