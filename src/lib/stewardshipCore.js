import { CIV_CONSTITUTION } from "./policy/constitutionCore.js";
import { REQUIRED_INVARIANTS } from "./policy/invariantsCore.js";

export const STEWARDSHIP_ROLE = Object.freeze({
  FOUNDER_STEWARD: "founder-steward",
  SYSTEM_STEWARD: "system-steward",
  MAINTENANCE_BOT: "maintenance-bot",
});

export const EMERGENCY_ACTION = Object.freeze({
  SAFE_HOLD: "SAFE_HOLD",
  READ_ONLY: "READ_ONLY",
  FULL_STOP: "FULL_STOP",
});

export const STEWARDSHIP_ACTION = Object.freeze({
  HANDOFF_ATTEMPT: "HANDOFF_ATTEMPT",
  HANDOFF_ACTIVATE: "HANDOFF_ACTIVATE",
  HANDOFF_RESET: "HANDOFF_RESET",
  EMERGENCY_ACTION: "EMERGENCY_ACTION",
});

export const STEWARDSHIP_ROLES = Object.freeze([
  Object.freeze({
    role_id: STEWARDSHIP_ROLE.FOUNDER_STEWARD,
    label: "Founder-Steward",
    advisory_only: false,
    can_approve_irreversible: true,
    revocable: true,
  }),
  Object.freeze({
    role_id: STEWARDSHIP_ROLE.SYSTEM_STEWARD,
    label: "System Steward",
    advisory_only: false,
    can_approve_irreversible: true,
    revocable: true,
  }),
  Object.freeze({
    role_id: STEWARDSHIP_ROLE.MAINTENANCE_BOT,
    label: "Maintenance Bot",
    advisory_only: true,
    can_approve_irreversible: false,
    revocable: true,
  }),
]);

const parseLogicalTime = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^s(\d+)$/);
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

const normalizeRole = (role) => {
  if (!role || typeof role !== "string") throw new Error("role is required.");
  const normalized = role.trim();
  if (Object.values(STEWARDSHIP_ROLE).includes(normalized)) return normalized;
  throw new Error(`Invalid stewardship role: ${role}`);
};

const normalizeEmergencyAction = (action) => {
  if (!action || typeof action !== "string") throw new Error("emergency_action is required.");
  const normalized = action.trim();
  if (Object.values(EMERGENCY_ACTION).includes(normalized)) return normalized;
  throw new Error(`Invalid emergency_action: ${action}`);
};

const normalizeActionType = (actionType) => {
  if (!actionType || typeof actionType !== "string") throw new Error("action_type is required.");
  const normalized = actionType.trim();
  if (Object.values(STEWARDSHIP_ACTION).includes(normalized)) return normalized;
  throw new Error(`Invalid stewardship action: ${actionType}`);
};

const getRoleConfig = (role) => STEWARDSHIP_ROLES.find((item) => item.role_id === role) ?? null;

export const canApproveIrreversible = (role) => {
  const config = getRoleConfig(normalizeRole(role));
  return Boolean(config?.can_approve_irreversible);
};

const isHumanSteward = (role) =>
  role === STEWARDSHIP_ROLE.FOUNDER_STEWARD || role === STEWARDSHIP_ROLE.SYSTEM_STEWARD;

export const createStewardshipState = (seed = {}) => ({
  stewardship_active: Boolean(seed.stewardship_active),
  builder_privileges_removed: Boolean(seed.builder_privileges_removed),
  log: Array.isArray(seed.log) ? seed.log.slice() : [],
  logicalClock: Number.isFinite(seed.logicalClock) ? seed.logicalClock : 0,
});

export const advanceStewardshipClock = (state) => {
  const nextValue = Math.max(0, Number(state?.logicalClock ?? 0)) + 1;
  return { state: { ...state, logicalClock: nextValue }, value: `s${nextValue}` };
};

const ensureLogicalClock = (state, createdAt) => {
  const parsed = parseLogicalTime(createdAt);
  if (parsed === null) return state;
  if (parsed <= state.logicalClock) return state;
  return { ...state, logicalClock: parsed };
};

export const appendStewardshipLog = (state, input) => {
  const actionType = normalizeActionType(input?.action_type);
  const actorRole = normalizeRole(input?.actor_role);
  const explanation = isNonEmptyString(input?.explanation) ? input.explanation.trim() : "";
  if (!explanation) throw new Error("explanation is required.");

  const baseState = createStewardshipState(state);
  let nextState = baseState;
  let createdAt = isNonEmptyString(input?.created_at) ? input.created_at.trim() : "";

  if (createdAt) {
    nextState = ensureLogicalClock(nextState, createdAt);
  } else {
    const advanced = advanceStewardshipClock(nextState);
    nextState = advanced.state;
    createdAt = advanced.value;
  }

  const entryId = isNonEmptyString(input?.entry_id) ? input.entry_id.trim() : `steward-${createdAt}`;
  const status = isNonEmptyString(input?.status) ? input.status.trim() : "RECORDED";
  const context = input?.context && typeof input.context === "object" ? input.context : {};

  const entry = Object.freeze({
    entry_id: entryId,
    action_type: actionType,
    actor_role: actorRole,
    explanation,
    status,
    context: Object.freeze({ ...context }),
    created_at: createdAt,
  });

  return {
    state: { ...nextState, log: [...nextState.log, entry] },
    entry,
  };
};

export const evaluateLaunchReadiness = (input) => {
  const constitutionLoaded = input?.constitution_loaded === true;
  const constitutionImmutable = input?.constitution_immutable === true || Object.isFrozen(CIV_CONSTITUTION);
  const invariantsVerified = input?.invariants_verified === true;
  const failureSimPass = input?.failure_simulations_passed === true;
  const humanApproval = input?.human_approval === true;
  const approverRole = isNonEmptyString(input?.approver_role) ? normalizeRole(input.approver_role) : null;
  const mockMode = input?.mock_mode === true;
  const driftScore = Number.isFinite(input?.drift_score) ? Number(input.drift_score) : null;
  const driftWarningThreshold = Number.isFinite(input?.drift_warning_threshold) ? Number(input.drift_warning_threshold) : 80;

  const reasons = [];
  if (!constitutionLoaded) reasons.push("constitution_not_loaded");
  if (!constitutionImmutable) reasons.push("constitution_not_immutable");
  if (!invariantsVerified) reasons.push("invariants_not_verified");
  if (!failureSimPass) reasons.push("failure_simulations_not_verified");
  if (mockMode) reasons.push("mock_mode_active");
  if (driftScore === null) {
    reasons.push("drift_score_missing");
  } else if (driftScore < driftWarningThreshold) {
    reasons.push("drift_score_below_warning_threshold");
  }
  if (!humanApproval) reasons.push("human_approval_missing");
  if (!approverRole || !isHumanSteward(approverRole)) reasons.push("approver_role_invalid");

  const status = reasons.length > 0 ? "SAFE_HOLD" : "ALLOW";
  const terminalOutcome = status === "ALLOW" ? "executed" : "halted";

  return Object.freeze({
    status,
    ok: status === "ALLOW",
    reasons: Object.freeze(reasons),
    terminal_outcome: terminalOutcome,
  });
};

export const applyStewardshipHandoff = (state, input) => {
  const baseState = createStewardshipState(state);
  const readiness = evaluateLaunchReadiness(input);
  const actorRole = normalizeRole(input?.actor_role ?? input?.approver_role ?? STEWARDSHIP_ROLE.FOUNDER_STEWARD);
  const explanation = isNonEmptyString(input?.explanation) ? input.explanation.trim() : "stewardship handoff";

  let nextState = baseState;
  let logResult;
  let status = readiness.status;
  let reasons = readiness.reasons;

  if (baseState.stewardship_active) {
    status = "SAFE_HOLD";
    reasons = Object.freeze([...reasons, "stewardship_already_active"]);
  }

  logResult = appendStewardshipLog(nextState, {
    action_type: STEWARDSHIP_ACTION.HANDOFF_ATTEMPT,
    actor_role: actorRole,
    explanation,
    status,
    context: { reasons },
    created_at: input?.created_at,
  });
  nextState = logResult.state;

  if (status !== "ALLOW") {
    return Object.freeze({ status, reasons, state: nextState, terminal_outcome: "halted" });
  }

  const activated = appendStewardshipLog(nextState, {
    action_type: STEWARDSHIP_ACTION.HANDOFF_ACTIVATE,
    actor_role: actorRole,
    explanation,
    status: "APPLIED",
    created_at: input?.created_at,
  });

  return Object.freeze({
    status: "APPLIED",
    reasons: Object.freeze([]),
    state: {
      ...activated.state,
      stewardship_active: true,
      builder_privileges_removed: true,
    },
    terminal_outcome: "executed",
  });
};

export const applyStewardshipReset = (state, input) => {
  const baseState = createStewardshipState(state);
  const actorRole = normalizeRole(input?.actor_role ?? STEWARDSHIP_ROLE.FOUNDER_STEWARD);
  const explanation = isNonEmptyString(input?.explanation) ? input.explanation.trim() : "";
  if (!explanation) throw new Error("explanation is required for reset.");

  if (!baseState.stewardship_active) {
    return Object.freeze({
      status: "SAFE_HOLD",
      reasons: Object.freeze(["stewardship_not_active"]),
      state: baseState,
      terminal_outcome: "halted",
    });
  }

  if (!input?.human_approval || !isHumanSteward(actorRole)) {
    return Object.freeze({
      status: "SAFE_HOLD",
      reasons: Object.freeze(["human_approval_required"]),
      state: baseState,
      terminal_outcome: "halted",
    });
  }

  const logged = appendStewardshipLog(baseState, {
    action_type: STEWARDSHIP_ACTION.HANDOFF_RESET,
    actor_role: actorRole,
    explanation,
    status: "APPLIED",
    created_at: input?.created_at,
  });

  return Object.freeze({
    status: "APPLIED",
    reasons: Object.freeze([]),
    state: {
      ...logged.state,
      stewardship_active: false,
      builder_privileges_removed: false,
    },
    terminal_outcome: "executed",
  });
};

export const recordEmergencyAction = (state, input) => {
  const actorRole = normalizeRole(input?.actor_role);
  if (!isHumanSteward(actorRole)) {
    throw new Error("Emergency actions require human stewardship role.");
  }
  const emergencyAction = normalizeEmergencyAction(input?.emergency_action);
  const explanation = isNonEmptyString(input?.explanation) ? input.explanation.trim() : "";
  if (!explanation) throw new Error("explanation is required for emergency actions.");

  const result = appendStewardshipLog(state, {
    action_type: STEWARDSHIP_ACTION.EMERGENCY_ACTION,
    actor_role: actorRole,
    explanation,
    status: "APPLIED",
    context: { emergency_action: emergencyAction },
    created_at: input?.created_at,
  });

  return Object.freeze({ state: result.state, entry: result.entry });
};

export const evaluateStewardshipGuard = (input) => {
  const stewardshipActive = input?.stewardship_active === true;
  const actionImpact = isNonEmptyString(input?.action_impact) ? input.action_impact.trim() : "";
  const humanApproval = input?.human_approval === true;
  const actorRole = isNonEmptyString(input?.actor_role) ? normalizeRole(input.actor_role) : null;
  const invariantsPassed = input?.invariants_passed === true;
  const constitutionPassed = input?.constitution_passed === true;

  const reasons = [];
  if (!invariantsPassed) reasons.push("invariants_failed");
  if (!constitutionPassed) reasons.push("constitution_failed");

  if (stewardshipActive && actionImpact === "IRREVERSIBLE") {
    if (!humanApproval) reasons.push("human_approval_required");
    if (!actorRole || !canApproveIrreversible(actorRole)) reasons.push("steward_role_invalid");
  }

  return Object.freeze({
    ok: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
};

export const getStewardshipTransparency = () => {
  const constitutionSummary = {
    purpose: CIV_CONSTITUTION.purpose,
    non_goals: CIV_CONSTITUTION.nonGoals,
  };
  const invariants = REQUIRED_INVARIANTS.map((inv) => ({
    id: inv.id,
    title: inv.title,
    description: inv.description,
  }));

  const stewardshipRules = Object.freeze([
    "Stewardship activation removes builder privileges.",
    "Irreversible actions require human stewardship approval.",
    "Maintenance Bot is advisory only.",
    "Emergency actions require explanation and immutable logging.",
  ]);

  const knownLimitations = Object.freeze([
    "No automatic recovery from SAFE_HOLD.",
    "History kernel is read-only unless explicitly queried.",
    "Governance conflicts halt execution until human review.",
  ]);

  return Object.freeze({
    constitution_summary: constitutionSummary,
    invariants,
    stewardship_roles: STEWARDSHIP_ROLES,
    stewardship_rules: stewardshipRules,
    known_limitations: knownLimitations,
    never_optimize_for: CIV_CONSTITUTION.nonGoals,
  });
};

export const getStewardshipLedger = (logEntries) =>
  (Array.isArray(logEntries) ? logEntries.slice() : [])
    .slice()
    .sort((a, b) => compareTime(a.created_at, b.created_at))
    .map((entry) => Object.freeze({ ...entry }));
