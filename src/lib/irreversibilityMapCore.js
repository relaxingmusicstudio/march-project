import { CIV_CONSTITUTION } from "./policy/constitutionCore.js";
import { REQUIRED_INVARIANTS } from "./policy/invariantsCore.js";

export const ACTION_IMPACT = Object.freeze({
  REVERSIBLE: "REVERSIBLE",
  DIFFICULT_TO_REVERSE: "DIFFICULT_TO_REVERSE",
  IRREVERSIBLE: "IRREVERSIBLE",
});

export const IRREVERSIBILITY_SCOPE = Object.freeze({
  USER: "user",
  POD: "pod",
  ECOSYSTEM: "ecosystem",
});

export const IRREVERSIBILITY_REVERSIBILITY = Object.freeze({
  NONE: "none",
  PARTIAL: "partial",
  DELAYED: "delayed",
});

export const IRREVERSIBILITY_APPROVAL = Object.freeze({
  HUMAN: "human",
  MULTI_HUMAN: "multi-human",
  GOVERNANCE: "governance",
  TIME_LOCK: "time-lock",
});

export const IRREVERSIBILITY_FALLBACK = Object.freeze({
  SAFE_HOLD: "SAFE_HOLD",
  ROLLBACK: "ROLLBACK",
  FREEZE: "FREEZE",
});

export const RELEASE_GATE = Object.freeze({
  GATE_A: "GATE_A",
  GATE_B: "GATE_B",
  GATE_C: "GATE_C",
});

export const EXECUTION_SCOPE = Object.freeze({
  LOCAL_POD: "local_pod",
  CROSS_POD: "cross_pod",
  SYSTEM: "system",
});

const IMPACT_ORDER = Object.freeze({
  [ACTION_IMPACT.REVERSIBLE]: 0,
  [ACTION_IMPACT.DIFFICULT_TO_REVERSE]: 1,
  [ACTION_IMPACT.IRREVERSIBLE]: 2,
});

export const IRREVERSIBILITY_MAP = Object.freeze({
  data_delete: ACTION_IMPACT.IRREVERSIBLE,
  policy_override: ACTION_IMPACT.IRREVERSIBLE,
  billing_migration: ACTION_IMPACT.DIFFICULT_TO_REVERSE,
  asset_ownership_transfer: ACTION_IMPACT.IRREVERSIBLE,
  pod_merge: ACTION_IMPACT.IRREVERSIBLE,
  pod_split: ACTION_IMPACT.IRREVERSIBLE,
  governance_rule_change: ACTION_IMPACT.IRREVERSIBLE,
  data_permanence_promotion: ACTION_IMPACT.IRREVERSIBLE,
  automation_escalation: ACTION_IMPACT.IRREVERSIBLE,
});

export const IRREVERSIBILITY_POINTS = Object.freeze([
  Object.freeze({
    point_id: "asset_ownership_transfer",
    description: "Transfer ownership of assets or equity.",
    affected_scope: IRREVERSIBILITY_SCOPE.ECOSYSTEM,
    reversibility: IRREVERSIBILITY_REVERSIBILITY.NONE,
    required_approvals: IRREVERSIBILITY_APPROVAL.MULTI_HUMAN,
    fallback_behavior: IRREVERSIBILITY_FALLBACK.FREEZE,
  }),
  Object.freeze({
    point_id: "pod_merge_split",
    description: "Merge or split pods, changing shared responsibility boundaries.",
    affected_scope: IRREVERSIBILITY_SCOPE.POD,
    reversibility: IRREVERSIBILITY_REVERSIBILITY.PARTIAL,
    required_approvals: IRREVERSIBILITY_APPROVAL.GOVERNANCE,
    fallback_behavior: IRREVERSIBILITY_FALLBACK.SAFE_HOLD,
  }),
  Object.freeze({
    point_id: "governance_rule_change",
    description: "Change governance rules or approval requirements.",
    affected_scope: IRREVERSIBILITY_SCOPE.ECOSYSTEM,
    reversibility: IRREVERSIBILITY_REVERSIBILITY.DELAYED,
    required_approvals: IRREVERSIBILITY_APPROVAL.GOVERNANCE,
    fallback_behavior: IRREVERSIBILITY_FALLBACK.SAFE_HOLD,
  }),
  Object.freeze({
    point_id: "data_permanence_promotion",
    description: "Promote data to append-only permanence.",
    affected_scope: IRREVERSIBILITY_SCOPE.ECOSYSTEM,
    reversibility: IRREVERSIBILITY_REVERSIBILITY.DELAYED,
    required_approvals: IRREVERSIBILITY_APPROVAL.TIME_LOCK,
    fallback_behavior: IRREVERSIBILITY_FALLBACK.SAFE_HOLD,
  }),
  Object.freeze({
    point_id: "automation_escalation",
    description: "Escalate automation to replace human roles or approvals.",
    affected_scope: IRREVERSIBILITY_SCOPE.ECOSYSTEM,
    reversibility: IRREVERSIBILITY_REVERSIBILITY.NONE,
    required_approvals: IRREVERSIBILITY_APPROVAL.MULTI_HUMAN,
    fallback_behavior: IRREVERSIBILITY_FALLBACK.SAFE_HOLD,
  }),
]);

const parseLogicalTime = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^e(\d+)$/);
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

const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeStringArray = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const unique = (values) => Array.from(new Set(values));

const normalizeImpact = (impact) => {
  if (!impact || typeof impact !== "string") return null;
  const normalized = impact.trim().toUpperCase();
  if (normalized === ACTION_IMPACT.REVERSIBLE) return ACTION_IMPACT.REVERSIBLE;
  if (normalized === ACTION_IMPACT.DIFFICULT_TO_REVERSE) return ACTION_IMPACT.DIFFICULT_TO_REVERSE;
  if (normalized === ACTION_IMPACT.IRREVERSIBLE) return ACTION_IMPACT.IRREVERSIBLE;
  return null;
};

const normalizeScope = (scope) => {
  const value = typeof scope === "string" ? scope.trim() : "";
  if (value === EXECUTION_SCOPE.LOCAL_POD) return EXECUTION_SCOPE.LOCAL_POD;
  if (value === EXECUTION_SCOPE.CROSS_POD) return EXECUTION_SCOPE.CROSS_POD;
  if (value === EXECUTION_SCOPE.SYSTEM) return EXECUTION_SCOPE.SYSTEM;
  return EXECUTION_SCOPE.LOCAL_POD;
};

const isImpactAtLeast = (declared, required) => {
  const declaredRank = IMPACT_ORDER[declared];
  const requiredRank = IMPACT_ORDER[required];
  if (declaredRank === undefined || requiredRank === undefined) return false;
  return declaredRank >= requiredRank;
};

const getForbiddenTargets = () => {
  const fromConstitution = CIV_CONSTITUTION.nonGoals.map(normalizeText);
  const fromInvariants = REQUIRED_INVARIANTS.flatMap((inv) => normalizeStringArray(inv.neverOptimizeFor)).map(normalizeText);
  return unique([...fromConstitution, ...fromInvariants]).filter(Boolean);
};

const findForbiddenTargets = (targets) => {
  const forbidden = getForbiddenTargets();
  const hits = [];
  for (const target of normalizeStringArray(targets)) {
    const normalizedTarget = normalizeText(target);
    if (!normalizedTarget) continue;
    if (forbidden.some((item) => normalizedTarget === item || normalizedTarget.includes(item))) hits.push(target);
  }
  return hits;
};

export const getRequiredImpact = (actionKey, mapOverride) => {
  const map = mapOverride && typeof mapOverride === "object" ? mapOverride : IRREVERSIBILITY_MAP;
  if (!actionKey || typeof actionKey !== "string") return null;
  return map[actionKey] ?? null;
};

export const getReleaseGate = (scope, impact) => {
  if (impact === ACTION_IMPACT.IRREVERSIBLE) return RELEASE_GATE.GATE_C;
  if (normalizeScope(scope) !== EXECUTION_SCOPE.LOCAL_POD) return RELEASE_GATE.GATE_B;
  return RELEASE_GATE.GATE_A;
};

export const evaluateExecutionDecision = (input) => {
  const actionKey = isNonEmptyString(input?.action_key) ? input.action_key.trim() : "";
  const actionImpact = normalizeImpact(input?.action_impact);
  const scope = normalizeScope(input?.scope);
  const invariantsPassed = input?.invariants_passed === true;
  const constitutionPassed =
    input?.constitution_passed === true || (input?.constitution_passed == null && invariantsPassed);
  const autoExecuteRequested = input?.auto_execute_requested === true;
  const evidence = normalizeStringArray(input?.evidence);
  const stagedRollout = input?.staged_rollout === true;
  const humanApproval = input?.human_approval === true;
  const rationale = isNonEmptyString(input?.rationale) ? input.rationale.trim() : "";
  const coolingOffWindow = isNonEmptyString(input?.cooling_off_window) ? input.cooling_off_window.trim() : "";
  const timeDelay = isNonEmptyString(input?.time_delay) ? input.time_delay.trim() : "";
  const timeDelayElapsed = input?.time_delay_elapsed === true;
  const driftScore = Number.isFinite(input?.drift_score) ? Number(input.drift_score) : null;
  const driftThreshold = Number.isFinite(input?.drift_score_threshold) ? Number(input.drift_score_threshold) : 0.8;
  const mockMode = input?.mock_mode === true;

  const reasons = [];
  if (!actionImpact) {
    reasons.push("missing_action_impact");
  }

  if (!invariantsPassed) {
    reasons.push("invariants_failed");
  }
  if (!constitutionPassed) {
    reasons.push("constitution_check_failed");
  }

  const forbiddenTargets = findForbiddenTargets(input?.declared_optimization_targets ?? []);
  if (forbiddenTargets.length > 0) {
    reasons.push("forbidden_optimization_target");
  }

  const requiredImpact = actionKey ? getRequiredImpact(actionKey, input?.irreversibility_map) : null;
  if (requiredImpact && actionImpact && !isImpactAtLeast(actionImpact, requiredImpact)) {
    reasons.push("impact_misclassified");
  }

  const gate = actionImpact ? getReleaseGate(scope, actionImpact) : RELEASE_GATE.GATE_A;

  if (actionImpact === ACTION_IMPACT.DIFFICULT_TO_REVERSE && !stagedRollout && evidence.length === 0) {
    reasons.push("evidence_or_staged_rollout_required");
  }

  if (actionImpact === ACTION_IMPACT.REVERSIBLE && gate === RELEASE_GATE.GATE_B && !stagedRollout && evidence.length === 0) {
    reasons.push("cross_pod_extra_checks_required");
  }

  if (actionImpact === ACTION_IMPACT.IRREVERSIBLE) {
    if (mockMode) {
      reasons.push("mock_mode_irreversible_blocked");
    }
    if (autoExecuteRequested) {
      reasons.push("auto_execute_forbidden_for_irreversible");
    }
    if (!humanApproval) {
      reasons.push("human_approval_required");
    }
    if (!rationale) {
      reasons.push("rationale_required");
    }
    if (!coolingOffWindow) {
      reasons.push("cooling_off_window_required");
    }
    if (normalizeScope(scope) !== EXECUTION_SCOPE.LOCAL_POD) {
      if (!timeDelay && !coolingOffWindow) {
        reasons.push("time_delay_required");
      } else if (!timeDelayElapsed) {
        reasons.push("time_delay_not_elapsed");
      }
    }
    if (driftScore === null) {
      reasons.push("drift_score_missing");
    } else if (driftScore < driftThreshold) {
      reasons.push("drift_score_below_threshold");
    }
  }

  const status = reasons.length > 0 ? "SAFE_HOLD" : "ALLOW";
  const allowAutoExecute = status === "ALLOW" && actionImpact !== ACTION_IMPACT.IRREVERSIBLE;
  const terminalOutcome = status === "ALLOW" ? "executed" : "halted";

  return Object.freeze({
    status,
    gate,
    action_impact: actionImpact,
    required_impact: requiredImpact,
    allow_auto_execute: allowAutoExecute,
    reasons: Object.freeze(reasons),
    terminal_outcome: terminalOutcome,
  });
};

export const createExecutionLedgerState = (seed = {}) => ({
  records: Array.isArray(seed.records) ? seed.records.slice() : [],
  logicalClock: Number.isFinite(seed.logicalClock) ? seed.logicalClock : 0,
});

export const advanceExecutionClock = (state) => {
  const nextValue = Math.max(0, Number(state?.logicalClock ?? 0)) + 1;
  return { state: { ...state, logicalClock: nextValue }, value: `e${nextValue}` };
};

const ensureLogicalClock = (state, createdAt) => {
  const parsed = parseLogicalTime(createdAt);
  if (parsed === null) return state;
  if (parsed <= state.logicalClock) return state;
  return { ...state, logicalClock: parsed };
};

export const appendExecutionRecord = (state, input) => {
  const actionKey = isNonEmptyString(input?.action_key) ? input.action_key.trim() : "";
  const intentId = isNonEmptyString(input?.intent_id) ? input.intent_id.trim() : "";
  const actionImpact = normalizeImpact(input?.action_impact);
  const scope = normalizeScope(input?.scope);

  if (!actionKey) throw new Error("action_key is required.");
  if (!intentId) throw new Error("intent_id is required.");
  if (!actionImpact) throw new Error("action_impact is required.");

  const rationale = isNonEmptyString(input?.rationale) ? input.rationale.trim() : "";
  const coolingOffWindow = isNonEmptyString(input?.cooling_off_window) ? input.cooling_off_window.trim() : "";
  const humanApproval = input?.human_approval === true;

  if (actionImpact === ACTION_IMPACT.IRREVERSIBLE) {
    if (!humanApproval) throw new Error("human_approval is required for irreversible actions.");
    if (!rationale) throw new Error("rationale is required for irreversible actions.");
    if (!coolingOffWindow) throw new Error("cooling_off_window is required for irreversible actions.");
  }

  const baseState = createExecutionLedgerState(state);
  let nextState = baseState;
  let createdAt = isNonEmptyString(input?.created_at) ? input.created_at.trim() : "";

  if (createdAt) {
    nextState = ensureLogicalClock(nextState, createdAt);
  } else {
    const advanced = advanceExecutionClock(nextState);
    nextState = advanced.state;
    createdAt = advanced.value;
  }

  const recordId = isNonEmptyString(input?.record_id) ? input.record_id.trim() : `exec-${createdAt}`;
  const releaseGate = getReleaseGate(scope, actionImpact);

  const record = Object.freeze({
    record_id: recordId,
    action_key: actionKey,
    intent_id: intentId,
    action_impact: actionImpact,
    release_gate: releaseGate,
    created_at: createdAt,
    scope,
    rationale,
    cooling_off_window: coolingOffWindow,
    human_approval: humanApproval,
  });

  return {
    state: { ...nextState, records: [...nextState.records, record] },
    record,
  };
};

export const getExecutionLedger = (records) =>
  (Array.isArray(records) ? records.slice() : [])
    .slice()
    .sort((a, b) => compareTime(a.created_at, b.created_at))
    .map((record) => Object.freeze({ ...record }));
