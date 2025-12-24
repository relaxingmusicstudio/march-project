import { buildMaintenanceReport as buildMaintenanceReportCore } from "./reportCore.js";

export type PolicyMessage = { id: string; message: string };

export type DriftInputs = {
  invariantViolationsCount: number;
  prohibitedTargetHitsCount: number;
  missingIntentCount: number;
  missingApprovalCount: number;
};

export type BuildMaintenanceReportInput = {
  featureName: string;
  generatedAt?: string;
  declaredOptimizationTargets: string[];
  intentsPresent: boolean;
  appendOnlyPreserved: boolean;
  requiresHumanApprovalForR3: boolean;
  mockMode?: boolean;
  allowIntentlessInMock?: boolean;
  invariantViolations?: PolicyMessage[];
  driftInputs?: DriftInputs;
};

export type MaintenanceReportV1 = {
  version: "v1";
  generatedAt?: string;
  featureName: string;
  constitution: { purpose: string; nonGoals: ReadonlyArray<string> };
  invariants: { requiredIds: string[]; violations: PolicyMessage[] };
  policy: { ok: boolean; violations: PolicyMessage[]; warnings: PolicyMessage[] };
  drift: { score: number; inputs: DriftInputs };
};

export const buildMaintenanceReport: (input: BuildMaintenanceReportInput) => MaintenanceReportV1 = buildMaintenanceReportCore;

