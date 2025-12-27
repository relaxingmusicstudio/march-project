import type {
  ActionImpact,
  AgentProposal,
  ConfidenceDisclosure,
  EpistemicAssessment,
  ExplainabilitySnapshot,
  HandoffContract,
  LongHorizonCommitment,
  ModelTier,
  NormAssessment,
  PermissionTier,
  RoleConstitutionAuditRecord,
  RoleConstitutionDecision,
  EconomicAuditRecord,
  EconomicBudgetState,
  CostCategory,
  EconomicCostSource,
  SecondOrderEffects,
  SchedulingPolicy,
  TaskClass,
  EvaluationTask,
} from "./contracts";
import type { DriftGateDecision } from "./drift/gates";
import type { LongHorizonAssessment } from "./longHorizon";

export type AgentRuntimeMetrics = {
  uncertaintyVariance: number;
  rollbackRate: number;
  stableRuns: number;
};

export type AgentRuntimeContext = {
  agentId: string;
  actionDomain: string;
  decisionType: string;
  tool?: string;
  goalId?: string;
  taskId?: string;
  taskDescription?: string;
  taskType?: string;
  taskClass?: TaskClass;
  estimatedCostCents?: number;
  modelTier?: ModelTier;
  modelId?: string;
  qualityScore?: number;
  evaluationPassed?: boolean;
  cacheHit?: boolean;
  ruleUsed?: boolean;
  durationMs?: number;
  retryCount?: number;
  humanOverride?: boolean;
  output?: Record<string, unknown>;
  schedulingPolicy?: SchedulingPolicy;
  explorationMode?: boolean;
  actionTags?: string[];
  dataCategories?: string[];
  costUnits?: number;
  costCategory?: CostCategory;
  costChargeId?: string;
  costSource?: EconomicCostSource;
  secondOrderEffects?: SecondOrderEffects;
  longHorizonCommitment?: LongHorizonCommitment;
  normJustification?: string;
  permissionTier: PermissionTier;
  impact?: ActionImpact;
  confidence: ConfidenceDisclosure;
  explainability?: ExplainabilitySnapshot;
  proposals?: AgentProposal[];
  activeProposalId?: string;
  disagreementTopic?: string;
  handoff?: HandoffContract;
  noveltyScore?: number;
  ambiguityCount?: number;
  metrics?: AgentRuntimeMetrics;
  evaluationTasks?: EvaluationTask[];
};

export type RuntimeGovernanceEvaluation = {
  runId: string;
  passRate: number;
  failed: number;
  rotationOk: boolean;
  failureDebt: {
    totalFailures: number;
    blocked: boolean;
    escalated: boolean;
    reasons: string[];
  };
  regression?: {
    allowed: boolean;
    reason: string;
    passRateDelta: number;
    regressed: string[];
  };
  visibility?: {
    improved: string[];
    regressed: string[];
    unchanged: string[];
  };
};

export type EscalationDecision = {
  escalate: boolean;
  reasons: string[];
};

export type PromotionDecision = {
  eligible: boolean;
  nextTier: PermissionTier;
  reasons: string[];
};

export type RuntimeGovernanceDecision = {
  allowed: boolean;
  reason: string;
  requiresHumanReview: boolean;
  details: {
    goal?: {
      goalId: string;
      status: "active" | "expired" | "suspended";
      expiresAt: string;
      requiresReaffirmation: boolean;
      conflictId?: string;
      conflictReason?: string;
      arbitrationProtocolId?: string;
    };
    epistemic?: EpistemicAssessment;
    secondOrder?: {
      allowed: boolean;
      reason?: string;
      requiresHumanReview: boolean;
    };
    norms?: NormAssessment;
    longHorizon?: {
      assessment: LongHorizonAssessment;
      debtRecorded: number;
    };
    scope?: { allowed: boolean; reason?: string };
    handoff?: { allowed: boolean; reason?: string };
    roleConstitution?: {
      decision: RoleConstitutionDecision;
      audit: RoleConstitutionAuditRecord;
    };
    economic?: {
      allowed: boolean;
      reason: string;
      costUnits: number;
      costCategory: CostCategory;
      budget: EconomicBudgetState;
      audit: EconomicAuditRecord;
      requiresHumanReview: boolean;
    };
    disagreement?: {
      disagreementId: string;
      refereeDecisionId: string;
      action: "select" | "merge" | "escalate";
      selectedProposalIds: string[];
      requiresHumanReview: boolean;
    };
    evaluation?: RuntimeGovernanceEvaluation;
    drift?: {
      report: {
        reportId: string;
        severity: "none" | "low" | "medium" | "high";
        reasons: string[];
        window: { baselineStart: string; baselineEnd: string; recentStart: string; recentEnd: string };
        anchorId: string;
        anchorVersion: string;
      };
      gate: DriftGateDecision;
    };
    cost?: {
      allowed: boolean;
      reason: string;
      requiresHumanReview: boolean;
      softLimitExceeded: boolean;
      hardLimitExceeded: boolean;
      demotedTier?: PermissionTier;
      routingTierCap?: ModelTier;
    };
    autonomy?: {
      currentTier: PermissionTier;
      requestedTier: PermissionTier;
      promotion?: PromotionDecision;
    };
    scheduling?: {
      executeNow: boolean;
      reason: string;
      scheduleId?: string;
      scheduledAt?: string;
      batchKey?: string;
    };
    escalation?: EscalationDecision;
  };
};
