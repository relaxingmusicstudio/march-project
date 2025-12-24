import {
  ACTION_IMPACT,
  IRREVERSIBILITY_SCOPE,
  IRREVERSIBILITY_REVERSIBILITY,
  IRREVERSIBILITY_APPROVAL,
  IRREVERSIBILITY_FALLBACK,
  RELEASE_GATE,
  EXECUTION_SCOPE,
  IRREVERSIBILITY_MAP,
  IRREVERSIBILITY_POINTS,
  getRequiredImpact as getRequiredImpactCore,
  getReleaseGate as getReleaseGateCore,
  evaluateExecutionDecision as evaluateExecutionDecisionCore,
  createExecutionLedgerState as createExecutionLedgerStateCore,
  advanceExecutionClock as advanceExecutionClockCore,
  appendExecutionRecord as appendExecutionRecordCore,
  getExecutionLedger as getExecutionLedgerCore,
} from "./irreversibilityMapCore.js";

export type ActionImpact = (typeof ACTION_IMPACT)[keyof typeof ACTION_IMPACT];
export const ActionImpact = ACTION_IMPACT;

export type IrreversibilityScope = (typeof IRREVERSIBILITY_SCOPE)[keyof typeof IRREVERSIBILITY_SCOPE];
export const IrreversibilityScope = IRREVERSIBILITY_SCOPE;

export type IrreversibilityReversibility =
  (typeof IRREVERSIBILITY_REVERSIBILITY)[keyof typeof IRREVERSIBILITY_REVERSIBILITY];
export const IrreversibilityReversibility = IRREVERSIBILITY_REVERSIBILITY;

export type IrreversibilityApproval = (typeof IRREVERSIBILITY_APPROVAL)[keyof typeof IRREVERSIBILITY_APPROVAL];
export const IrreversibilityApproval = IRREVERSIBILITY_APPROVAL;

export type IrreversibilityFallback = (typeof IRREVERSIBILITY_FALLBACK)[keyof typeof IRREVERSIBILITY_FALLBACK];
export const IrreversibilityFallback = IRREVERSIBILITY_FALLBACK;

export type ReleaseGate = (typeof RELEASE_GATE)[keyof typeof RELEASE_GATE];
export const ReleaseGate = RELEASE_GATE;

export type ExecutionScope = (typeof EXECUTION_SCOPE)[keyof typeof EXECUTION_SCOPE];
export const ExecutionScope = EXECUTION_SCOPE;

export const IrreversibilityMap = IRREVERSIBILITY_MAP;
export const IrreversibilityPoints = IRREVERSIBILITY_POINTS;

export type IrreversibilityPoint = {
  point_id: string;
  description: string;
  affected_scope: IrreversibilityScope;
  reversibility: IrreversibilityReversibility;
  required_approvals: IrreversibilityApproval;
  fallback_behavior: IrreversibilityFallback;
};

export type ExecutionDecisionInput = {
  action_key: string;
  action_impact: ActionImpact;
  scope?: ExecutionScope;
  invariants_passed?: boolean;
  constitution_passed?: boolean;
  auto_execute_requested?: boolean;
  evidence?: string[];
  staged_rollout?: boolean;
  human_approval?: boolean;
  rationale?: string;
  cooling_off_window?: string;
  time_delay?: string;
  time_delay_elapsed?: boolean;
  drift_score?: number;
  drift_score_threshold?: number;
  declared_optimization_targets?: string[];
  irreversibility_map?: Record<string, ActionImpact>;
  mock_mode?: boolean;
};

export type ExecutionDecisionResult = {
  status: "ALLOW" | "SAFE_HOLD";
  gate: ReleaseGate;
  action_impact: ActionImpact | null;
  required_impact: ActionImpact | null;
  allow_auto_execute: boolean;
  reasons: ReadonlyArray<string>;
  terminal_outcome: "executed" | "halted";
};

export type ExecutionLedgerRecord = {
  record_id: string;
  action_key: string;
  intent_id: string;
  action_impact: ActionImpact;
  release_gate: ReleaseGate;
  created_at: string;
  scope: ExecutionScope;
  rationale: string;
  cooling_off_window: string;
  human_approval: boolean;
};

export type ExecutionLedgerState = {
  records: ExecutionLedgerRecord[];
  logicalClock: number;
};

export const getRequiredImpact: (actionKey: string, mapOverride?: Record<string, ActionImpact>) => ActionImpact | null =
  getRequiredImpactCore;

export const getReleaseGate: (scope: ExecutionScope, impact: ActionImpact) => ReleaseGate = getReleaseGateCore;

export const evaluateExecutionDecision: (input: ExecutionDecisionInput) => ExecutionDecisionResult = evaluateExecutionDecisionCore;

export const createExecutionLedgerState: (seed?: Partial<ExecutionLedgerState>) => ExecutionLedgerState =
  createExecutionLedgerStateCore;

export const advanceExecutionClock: (state: ExecutionLedgerState) => { state: ExecutionLedgerState; value: string } =
  advanceExecutionClockCore;

export const appendExecutionRecord: (
  state: ExecutionLedgerState,
  input: {
    record_id?: string;
    action_key: string;
    intent_id: string;
    action_impact: ActionImpact;
    scope?: ExecutionScope;
    created_at?: string;
    rationale?: string;
    cooling_off_window?: string;
    human_approval?: boolean;
  }
) => { state: ExecutionLedgerState; record: ExecutionLedgerRecord } = appendExecutionRecordCore;

export const getExecutionLedger: (records: ExecutionLedgerRecord[]) => ExecutionLedgerRecord[] = getExecutionLedgerCore;
