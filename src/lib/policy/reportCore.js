import { CIV_CONSTITUTION } from "./constitutionCore.js";
import { REQUIRED_INVARIANTS } from "./invariantsCore.js";
import { computeDriftScore } from "./driftScoreCore.js";
import { evaluatePolicy } from "./policyEngineCore.js";

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const normalizeMessageItem = (item) => {
  if (!item || typeof item !== "object") return null;
  const id = isNonEmptyString(item.id) ? item.id.trim() : "";
  const message = isNonEmptyString(item.message) ? item.message.trim() : "";
  if (!id || !message) return null;
  return Object.freeze({ id, message });
};

export const buildMaintenanceReport = (input) => {
  const featureName = isNonEmptyString(input?.featureName) ? input.featureName.trim() : "unknown";
  const generatedAt = isNonEmptyString(input?.generatedAt) ? input.generatedAt.trim() : undefined;

  const declaredOptimizationTargets = Array.isArray(input?.declaredOptimizationTargets)
    ? input.declaredOptimizationTargets.filter(isNonEmptyString).map((t) => t.trim())
    : [];

  const policy = evaluatePolicy({
    featureName,
    declaredOptimizationTargets,
    intentsPresent: Boolean(input?.intentsPresent),
    appendOnlyPreserved: Boolean(input?.appendOnlyPreserved),
    requiresHumanApprovalForR3: Boolean(input?.requiresHumanApprovalForR3),
    mockMode: Boolean(input?.mockMode),
    allowIntentlessInMock: Boolean(input?.allowIntentlessInMock),
  });

  const invariantViolations = Array.isArray(input?.invariantViolations)
    ? input.invariantViolations.map(normalizeMessageItem).filter(Boolean)
    : [];

  const driftInputs = {
    invariantViolationsCount: Number(input?.driftInputs?.invariantViolationsCount ?? invariantViolations.length),
    prohibitedTargetHitsCount: Number(input?.driftInputs?.prohibitedTargetHitsCount ?? 0),
    missingIntentCount: Number(input?.driftInputs?.missingIntentCount ?? 0),
    missingApprovalCount: Number(input?.driftInputs?.missingApprovalCount ?? 0),
  };

  const report = {
    version: "v1",
    ...(generatedAt ? { generatedAt } : {}),
    featureName,
    constitution: {
      purpose: CIV_CONSTITUTION.purpose,
      nonGoals: CIV_CONSTITUTION.nonGoals,
    },
    invariants: {
      requiredIds: REQUIRED_INVARIANTS.map((inv) => inv.id),
      violations: invariantViolations,
    },
    policy,
    drift: {
      score: computeDriftScore(driftInputs),
      inputs: driftInputs,
    },
  };

  return Object.freeze(report);
};

