import { CIV_CONSTITUTION } from "./policy/constitutionCore.js";
import { REQUIRED_INVARIANTS } from "./policy/invariantsCore.js";

export const GOVERNANCE_SCOPE = Object.freeze({
  LOCAL_POD: "local_pod",
  CROSS_POD: "cross_pod",
  SYSTEM: "system",
});

export const GOVERNANCE_INITIATOR = Object.freeze({
  HUMAN: "human",
  POD: "pod",
  SYSTEM: "system",
});

const parseLogicalTime = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^g(\d+)$/);
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

const unique = (values) => Array.from(new Set(values));

const freezeDecision = (decision) => Object.freeze({ ...decision });

const getInvariantIds = () => REQUIRED_INVARIANTS.map((inv) => inv.id);

const normalizeInvariantIds = (value) => {
  const allowed = new Set(getInvariantIds());
  const normalized = unique(normalizeStringArray(value)).sort();
  const invalid = normalized.filter((id) => !allowed.has(id));
  if (invalid.length > 0) {
    throw new Error(`Unknown invariant id(s): ${invalid.join(", ")}`);
  }
  return Object.freeze(normalized);
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

export const createGovernanceState = (seed = {}) => ({
  decisions: Array.isArray(seed.decisions) ? seed.decisions.slice() : [],
  logicalClock: Number.isFinite(seed.logicalClock) ? seed.logicalClock : 0,
});

export const advanceGovernanceClock = (state) => {
  const nextValue = Math.max(0, Number(state?.logicalClock ?? 0)) + 1;
  return { state: { ...state, logicalClock: nextValue }, value: `g${nextValue}` };
};

const ensureLogicalClock = (state, createdAt) => {
  const parsed = parseLogicalTime(createdAt);
  if (parsed === null) return state;
  if (parsed <= state.logicalClock) return state;
  return { ...state, logicalClock: parsed };
};

const normalizeScope = (scope) => {
  const value = typeof scope === "string" ? scope.trim() : "";
  if (value === GOVERNANCE_SCOPE.LOCAL_POD) return GOVERNANCE_SCOPE.LOCAL_POD;
  if (value === GOVERNANCE_SCOPE.CROSS_POD) return GOVERNANCE_SCOPE.CROSS_POD;
  if (value === GOVERNANCE_SCOPE.SYSTEM) return GOVERNANCE_SCOPE.SYSTEM;
  throw new Error(`Invalid governance scope: ${scope}`);
};

const normalizeInitiator = (initiator) => {
  const value = typeof initiator === "string" ? initiator.trim() : "";
  if (value === GOVERNANCE_INITIATOR.HUMAN) return GOVERNANCE_INITIATOR.HUMAN;
  if (value === GOVERNANCE_INITIATOR.POD) return GOVERNANCE_INITIATOR.POD;
  if (value === GOVERNANCE_INITIATOR.SYSTEM) return GOVERNANCE_INITIATOR.SYSTEM;
  throw new Error(`Invalid governance initiator: ${initiator}`);
};

const normalizeDecisionKey = (value, fallback) => {
  const normalized = typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
  return normalized;
};

export const appendGovernanceDecision = (state, input) => {
  if (!input?.intent_id || typeof input.intent_id !== "string" || input.intent_id.trim().length === 0) {
    throw new Error("intent_id is required for governance decisions.");
  }
  if (!input?.justification || typeof input.justification !== "string" || input.justification.trim().length === 0) {
    throw new Error("justification is required for governance decisions.");
  }

  const scope = normalizeScope(input.scope);
  const initiator = normalizeInitiator(input.initiator);
  const requiresHumanApproval = Boolean(input.requires_human_approval);

  if (scope !== GOVERNANCE_SCOPE.LOCAL_POD && !requiresHumanApproval) {
    throw new Error("requires_human_approval must be true when scope is not local_pod.");
  }

  const podId = typeof input.pod_id === "string" && input.pod_id.trim().length > 0 ? input.pod_id.trim() : null;
  const targetPodIds = normalizeStringArray(input.target_pod_ids);
  if (scope === GOVERNANCE_SCOPE.LOCAL_POD && !podId) {
    throw new Error("pod_id is required for local_pod decisions.");
  }
  if (scope === GOVERNANCE_SCOPE.CROSS_POD && targetPodIds.length === 0) {
    throw new Error("target_pod_ids is required for cross_pod decisions.");
  }

  const affectedInvariants = normalizeInvariantIds(input.affected_invariants ?? []);
  const forbiddenTargets = findForbiddenTargets(input.declared_optimization_targets ?? []);
  if (forbiddenTargets.length > 0) {
    throw new Error(`Forbidden optimization target(s): ${forbiddenTargets.join(", ")}`);
  }

  const baseState = createGovernanceState(state);
  let nextState = baseState;
  let createdAt = typeof input.created_at === "string" ? input.created_at : null;

  if (createdAt) {
    nextState = ensureLogicalClock(nextState, createdAt);
  } else {
    const advanced = advanceGovernanceClock(nextState);
    nextState = advanced.state;
    createdAt = advanced.value;
  }

  const governanceId = typeof input.governance_id === "string" && input.governance_id.trim().length > 0 ? input.governance_id : `gov-${createdAt}`;
  const decisionKey = normalizeDecisionKey(input.decision_key, governanceId);

  const decision = freezeDecision({
    governance_id: governanceId,
    scope,
    initiator,
    justification: input.justification.trim(),
    affected_invariants: affectedInvariants,
    requires_human_approval: requiresHumanApproval,
    intent_id: input.intent_id.trim(),
    pod_id: podId,
    target_pod_ids: Object.freeze(targetPodIds),
    decision_key: decisionKey,
    created_at: createdAt,
  });

  return {
    state: { ...nextState, decisions: [...nextState.decisions, decision] },
    decision,
  };
};

export const canExecuteDecision = (decision, context = {}) => {
  const approvalGranted = context.approval_granted === true;
  const executorInitiator = context.initiator ? normalizeInitiator(context.initiator) : null;
  const executorPodId = typeof context.pod_id === "string" && context.pod_id.trim().length > 0 ? context.pod_id.trim() : null;

  if (decision.scope !== GOVERNANCE_SCOPE.LOCAL_POD) {
    if (!approvalGranted) {
      return Object.freeze({ ok: false, reason: "human_approval_required" });
    }
    if (executorInitiator !== GOVERNANCE_INITIATOR.HUMAN) {
      return Object.freeze({ ok: false, reason: "human_executor_required" });
    }
    return Object.freeze({ ok: true, reason: "approved" });
  }

  if (decision.pod_id && executorPodId !== decision.pod_id) {
    return Object.freeze({ ok: false, reason: "pod_scope_mismatch" });
  }

  return Object.freeze({ ok: true, reason: "local_pod_scope" });
};

export const detectGovernanceConflicts = (decisions) => {
  const groups = new Map();
  for (const decision of decisions ?? []) {
    const key = decision?.decision_key ?? decision?.governance_id;
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(decision);
    groups.set(key, list);
  }

  const conflicts = [];
  for (const [key, list] of groups.entries()) {
    if (list.length < 2) continue;
    const intents = unique(list.map((item) => item.intent_id));
    const justifications = unique(list.map((item) => item.justification));
    if (intents.length > 1 || justifications.length > 1) {
      conflicts.push(
        Object.freeze({
          decision_key: key,
          governance_ids: Object.freeze(list.map((item) => item.governance_id)),
          reasons: Object.freeze(
            [
              intents.length > 1 ? "intent_conflict" : null,
              justifications.length > 1 ? "justification_conflict" : null,
            ].filter(Boolean)
          ),
        })
      );
    }
  }

  return Object.freeze(conflicts);
};

export const evaluateGovernanceState = (decisions) => {
  const conflicts = detectGovernanceConflicts(decisions);
  const hasConflicts = conflicts.length > 0;
  const mode = hasConflicts ? "SAFE_HOLD" : "CLEAR";
  const terminalOutcome = hasConflicts ? "halted" : "executed";
  return Object.freeze({
    mode,
    requires_human_approval: hasConflicts,
    conflicts: hasConflicts ? conflicts : Object.freeze([]),
    terminal_outcome: terminalOutcome,
  });
};

export const getGovernanceLedger = (decisions) =>
  (Array.isArray(decisions) ? decisions.slice() : [])
    .slice()
    .sort((a, b) => compareTime(a.created_at, b.created_at))
    .map((decision) => freezeDecision(decision));
