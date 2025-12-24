import {
  GOVERNANCE_SCOPE,
  GOVERNANCE_INITIATOR,
  createGovernanceState as createGovernanceStateCore,
  advanceGovernanceClock as advanceGovernanceClockCore,
  appendGovernanceDecision as appendGovernanceDecisionCore,
  canExecuteDecision as canExecuteDecisionCore,
  detectGovernanceConflicts as detectGovernanceConflictsCore,
  evaluateGovernanceState as evaluateGovernanceStateCore,
  getGovernanceLedger as getGovernanceLedgerCore,
} from "./governanceModelCore.js";

export type GovernanceScope = (typeof GOVERNANCE_SCOPE)[keyof typeof GOVERNANCE_SCOPE];
export const GovernanceScope = GOVERNANCE_SCOPE;

export type GovernanceInitiator = (typeof GOVERNANCE_INITIATOR)[keyof typeof GOVERNANCE_INITIATOR];
export const GovernanceInitiator = GOVERNANCE_INITIATOR;

export type GovernanceDecision = {
  governance_id: string;
  scope: GovernanceScope;
  initiator: GovernanceInitiator;
  justification: string;
  affected_invariants: ReadonlyArray<string>;
  requires_human_approval: boolean;
  intent_id: string;
  pod_id: string | null;
  target_pod_ids: ReadonlyArray<string>;
  decision_key: string;
  created_at: string;
};

export type GovernanceState = {
  decisions: GovernanceDecision[];
  logicalClock: number;
};

export type GovernanceDecisionInput = {
  governance_id?: string;
  scope: GovernanceScope;
  initiator: GovernanceInitiator;
  justification: string;
  affected_invariants: string[];
  requires_human_approval: boolean;
  intent_id: string;
  pod_id?: string | null;
  target_pod_ids?: string[];
  decision_key?: string;
  created_at?: string;
  declared_optimization_targets?: string[];
};

export type GovernanceExecutionContext = {
  initiator?: GovernanceInitiator;
  pod_id?: string | null;
  approval_granted?: boolean;
};

export type GovernanceExecutionResult = {
  ok: boolean;
  reason: string;
};

export type GovernanceConflict = {
  decision_key: string;
  governance_ids: ReadonlyArray<string>;
  reasons: ReadonlyArray<string>;
};

export type GovernanceStateEvaluation = {
  mode: "SAFE_HOLD" | "CLEAR";
  requires_human_approval: boolean;
  conflicts: ReadonlyArray<GovernanceConflict>;
  terminal_outcome: "executed" | "halted";
};

export const createGovernanceState: (seed?: Partial<GovernanceState>) => GovernanceState = createGovernanceStateCore;
export const advanceGovernanceClock: (state: GovernanceState) => { state: GovernanceState; value: string } = advanceGovernanceClockCore;
export const appendGovernanceDecision: (
  state: GovernanceState,
  input: GovernanceDecisionInput
) => { state: GovernanceState; decision: GovernanceDecision } = appendGovernanceDecisionCore;
export const canExecuteDecision: (
  decision: GovernanceDecision,
  context?: GovernanceExecutionContext
) => GovernanceExecutionResult = canExecuteDecisionCore;
export const detectGovernanceConflicts: (decisions: GovernanceDecision[]) => ReadonlyArray<GovernanceConflict> = detectGovernanceConflictsCore;
export const evaluateGovernanceState: (decisions: GovernanceDecision[]) => GovernanceStateEvaluation = evaluateGovernanceStateCore;
export const getGovernanceLedger: (decisions: GovernanceDecision[]) => GovernanceDecision[] = getGovernanceLedgerCore;
