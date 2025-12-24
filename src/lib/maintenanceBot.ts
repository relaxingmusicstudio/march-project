import {
  MAINTENANCE_BOT_RULES,
  evaluateInvariantViolations as evaluateInvariantViolationsCore,
  computeDriftScore as computeDriftScoreCore,
  buildMaintenanceReport as buildMaintenanceReportCore,
  appendMaintenanceReport as appendMaintenanceReportCore,
  getSafeModeFallback as getSafeModeFallbackCore,
  evaluateMaintenancePreflight as evaluateMaintenancePreflightCore,
} from "./maintenanceBotCore.js";

export type MaintenanceMessage = {
  id: string;
  message: string;
};

export type MaintenanceDriftLine = {
  id: string;
  label: string;
  weight: number;
  count: number;
  penalty: number;
  explanation: string;
};

export type MaintenanceDriftScore = {
  score: number;
  lines: MaintenanceDriftLine[];
};

export type MaintenanceSignalInput = {
  featureName?: string;
  declaredOptimizationTargets?: string[];
  intentsPresent?: boolean;
  appendOnlyPreserved?: boolean;
  requiresHumanApprovalForR3?: boolean;
  mockMode?: boolean;
  allowIntentlessInMock?: boolean;
  centralControlDetected?: boolean;
  authorityBypassDetected?: boolean;
  claimsWithoutEvidenceDetected?: boolean;
  evidenceMissing?: boolean;
};

export type MaintenanceReport = {
  version: "v1";
  timestamp: string;
  drift_score: MaintenanceDriftScore;
  invariant_violations: MaintenanceMessage[];
  warnings: MaintenanceMessage[];
  recommendations: string[];
};

export type MaintenancePreflightResult = {
  status: "PASS" | "FAIL";
  reasons: string[];
  safeMode: boolean;
  requiresHumanIntervention: boolean;
  terminal_outcome: "executed" | "halted";
};

export type SafeModeFallback = {
  mode: "SAFE_MODE";
  reason: string;
  automationAllowed: false;
  escalationAllowed: false;
  requiresHumanIntervention: true;
};

export const MAINTENANCE_RULES = MAINTENANCE_BOT_RULES;

export const evaluateInvariantViolations: (input: MaintenanceSignalInput) => {
  violations: MaintenanceMessage[];
  warnings: MaintenanceMessage[];
} = evaluateInvariantViolationsCore;

export const computeDriftScore: (input: {
  invariantViolationsCount: number;
  prohibitedTargetHitsCount: number;
  missingIntentCount: number;
  appendOnlyBreachCount: number;
  missingApprovalCount: number;
}) => MaintenanceDriftScore = computeDriftScoreCore;

export const buildMaintenanceReport: (input: MaintenanceSignalInput & { timestamp?: string }) => MaintenanceReport =
  buildMaintenanceReportCore;

export const appendMaintenanceReport: (history: MaintenanceReport[], report: MaintenanceReport, limit?: number) => MaintenanceReport[] =
  appendMaintenanceReportCore;

export const getSafeModeFallback: (reason?: string) => SafeModeFallback = getSafeModeFallbackCore;

export const evaluateMaintenancePreflight: (input: MaintenanceSignalInput) => MaintenancePreflightResult =
  evaluateMaintenancePreflightCore;
