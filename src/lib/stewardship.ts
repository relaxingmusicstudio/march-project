import {
  STEWARDSHIP_ROLE,
  STEWARDSHIP_ROLES,
  EMERGENCY_ACTION,
  STEWARDSHIP_ACTION,
  canApproveIrreversible as canApproveIrreversibleCore,
  createStewardshipState as createStewardshipStateCore,
  advanceStewardshipClock as advanceStewardshipClockCore,
  appendStewardshipLog as appendStewardshipLogCore,
  evaluateLaunchReadiness as evaluateLaunchReadinessCore,
  applyStewardshipHandoff as applyStewardshipHandoffCore,
  applyStewardshipReset as applyStewardshipResetCore,
  recordEmergencyAction as recordEmergencyActionCore,
  evaluateStewardshipGuard as evaluateStewardshipGuardCore,
  getStewardshipTransparency as getStewardshipTransparencyCore,
  getStewardshipLedger as getStewardshipLedgerCore,
} from "./stewardshipCore.js";

export type StewardshipRole = (typeof STEWARDSHIP_ROLE)[keyof typeof STEWARDSHIP_ROLE];
export const StewardshipRole = STEWARDSHIP_ROLE;

export type StewardshipRoleConfig = {
  role_id: StewardshipRole;
  label: string;
  advisory_only: boolean;
  can_approve_irreversible: boolean;
  revocable: boolean;
};
export const StewardshipRoles = STEWARDSHIP_ROLES as ReadonlyArray<StewardshipRoleConfig>;

export type EmergencyAction = (typeof EMERGENCY_ACTION)[keyof typeof EMERGENCY_ACTION];
export const EmergencyAction = EMERGENCY_ACTION;

export type StewardshipActionType = (typeof STEWARDSHIP_ACTION)[keyof typeof STEWARDSHIP_ACTION];
export const StewardshipAction = STEWARDSHIP_ACTION;

export type StewardshipLogEntry = {
  entry_id: string;
  action_type: StewardshipActionType;
  actor_role: StewardshipRole;
  explanation: string;
  status: string;
  context: Record<string, unknown>;
  created_at: string;
};

export type StewardshipState = {
  stewardship_active: boolean;
  builder_privileges_removed: boolean;
  log: StewardshipLogEntry[];
  logicalClock: number;
};

export type LaunchReadinessInput = {
  constitution_loaded: boolean;
  constitution_immutable?: boolean;
  invariants_verified: boolean;
  failure_simulations_passed: boolean;
  drift_score: number;
  drift_warning_threshold?: number;
  human_approval: boolean;
  approver_role: StewardshipRole;
  mock_mode: boolean;
};

export type LaunchReadinessResult = {
  status: "ALLOW" | "SAFE_HOLD";
  ok: boolean;
  reasons: ReadonlyArray<string>;
  terminal_outcome: "executed" | "halted";
};

export type StewardshipHandoffInput = LaunchReadinessInput & {
  actor_role?: StewardshipRole;
  explanation?: string;
  created_at?: string;
};

export type StewardshipHandoffResult = {
  status: "APPLIED" | "SAFE_HOLD";
  reasons: ReadonlyArray<string>;
  state: StewardshipState;
  terminal_outcome: "executed" | "halted";
};

export type StewardshipResetInput = {
  actor_role: StewardshipRole;
  explanation: string;
  human_approval: boolean;
  created_at?: string;
};

export type StewardshipResetResult = {
  status: "APPLIED" | "SAFE_HOLD";
  reasons: ReadonlyArray<string>;
  state: StewardshipState;
  terminal_outcome: "executed" | "halted";
};

export type EmergencyActionInput = {
  actor_role: StewardshipRole;
  emergency_action: EmergencyAction;
  explanation: string;
  created_at?: string;
};

export type EmergencyActionResult = {
  state: StewardshipState;
  entry: StewardshipLogEntry;
};

export type StewardshipGuardInput = {
  stewardship_active: boolean;
  action_impact: string;
  human_approval: boolean;
  actor_role?: StewardshipRole;
  invariants_passed: boolean;
  constitution_passed: boolean;
};

export type StewardshipGuardResult = {
  ok: boolean;
  reasons: ReadonlyArray<string>;
};

export type StewardshipTransparency = {
  constitution_summary: { purpose: string; non_goals: ReadonlyArray<string> };
  invariants: ReadonlyArray<{ id: string; title: string; description: string }>;
  stewardship_roles: ReadonlyArray<StewardshipRoleConfig>;
  stewardship_rules: ReadonlyArray<string>;
  known_limitations: ReadonlyArray<string>;
  never_optimize_for: ReadonlyArray<string>;
};

export const canApproveIrreversible: (role: StewardshipRole) => boolean = canApproveIrreversibleCore;
export const createStewardshipState: (seed?: Partial<StewardshipState>) => StewardshipState = createStewardshipStateCore;
export const advanceStewardshipClock: (state: StewardshipState) => { state: StewardshipState; value: string } =
  advanceStewardshipClockCore;
export const appendStewardshipLog: (
  state: StewardshipState,
  input: {
    action_type: StewardshipActionType;
    actor_role: StewardshipRole;
    explanation: string;
    status?: string;
    context?: Record<string, unknown>;
    created_at?: string;
    entry_id?: string;
  }
) => { state: StewardshipState; entry: StewardshipLogEntry } = appendStewardshipLogCore;
export const evaluateLaunchReadiness: (input: LaunchReadinessInput) => LaunchReadinessResult = evaluateLaunchReadinessCore;
export const applyStewardshipHandoff: (state: StewardshipState, input: StewardshipHandoffInput) => StewardshipHandoffResult =
  applyStewardshipHandoffCore;
export const applyStewardshipReset: (state: StewardshipState, input: StewardshipResetInput) => StewardshipResetResult =
  applyStewardshipResetCore;
export const recordEmergencyAction: (state: StewardshipState, input: EmergencyActionInput) => EmergencyActionResult =
  recordEmergencyActionCore;
export const evaluateStewardshipGuard: (input: StewardshipGuardInput) => StewardshipGuardResult = evaluateStewardshipGuardCore;
export const getStewardshipTransparency: () => StewardshipTransparency = getStewardshipTransparencyCore;
export const getStewardshipLedger: (entries: StewardshipLogEntry[]) => StewardshipLogEntry[] = getStewardshipLedgerCore;
