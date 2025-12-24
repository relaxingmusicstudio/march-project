import { evaluatePolicy as evaluatePolicyCore } from "./policyEngineCore.js";

export type PolicyMessage = { id: string; message: string };

export type PolicyResult = {
  ok: boolean;
  violations: PolicyMessage[];
  warnings: PolicyMessage[];
};

export type PolicyInput = {
  featureName: string;
  declaredOptimizationTargets: string[];
  intentsPresent: boolean;
  appendOnlyPreserved: boolean;
  requiresHumanApprovalForR3: boolean;
  mockMode?: boolean;
  allowIntentlessInMock?: boolean;
};

export const evaluatePolicy: (input: PolicyInput) => PolicyResult = evaluatePolicyCore;

