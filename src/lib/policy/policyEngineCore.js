import { CIV_CONSTITUTION } from "./constitutionCore.js";

const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeStringArray = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];

const unique = (values) => Array.from(new Set(values));

const getProhibitedTargets = () => unique(CIV_CONSTITUTION.nonGoals.map(normalizeText)).filter(Boolean);

const findProhibitedTargetHits = (declaredTargets) => {
  const prohibited = getProhibitedTargets();
  const hits = [];

  for (const target of declaredTargets) {
    const normalizedTarget = normalizeText(target);
    if (!normalizedTarget) continue;
    if (prohibited.some((p) => normalizedTarget === p || normalizedTarget.includes(p))) hits.push(target);
  }

  return hits;
};

export const evaluatePolicy = (input) => {
  const featureName = typeof input?.featureName === "string" && input.featureName.trim() ? input.featureName.trim() : "unknown";
  const declaredOptimizationTargets = normalizeStringArray(input?.declaredOptimizationTargets);
  const intentsPresent = Boolean(input?.intentsPresent);
  const appendOnlyPreserved = Boolean(input?.appendOnlyPreserved);
  const requiresHumanApprovalForR3 = Boolean(input?.requiresHumanApprovalForR3);
  const mockMode = Boolean(input?.mockMode);
  const allowIntentlessInMock = Boolean(input?.allowIntentlessInMock);

  const violations = [];
  const warnings = [];

  const prohibitedHits = findProhibitedTargetHits(declaredOptimizationTargets);

  if (prohibitedHits.length) {
    violations.push({
      id: "policy::prohibited-optimization-target",
      message: `Prohibited optimization target(s): ${prohibitedHits.map((t) => `"${t}"`).join(", ")}.`,
    });
  }

  if (!intentsPresent) {
    if (mockMode && allowIntentlessInMock) {
      warnings.push({
        id: "policy::intent-missing-mock-allowed",
        message: "Intent is missing, but explicitly allowed in mock mode.",
      });
    } else {
      violations.push({
        id: "policy::intent-required",
        message: "Intent is required before action/optimization (intent_before_action).",
      });
    }
  }

  if (!appendOnlyPreserved) {
    violations.push({
      id: "policy::append-only-required",
      message: "Append-only history must be preserved (no destructive edits).",
    });
  }

  if (!requiresHumanApprovalForR3) {
    warnings.push({
      id: "policy::missing-human-approval-plumbing",
      message: "Human approval for R3 is not fully enforced yet (warning only).",
    });
  }

  return Object.freeze({
    ok: violations.length === 0,
    violations: Object.freeze(violations),
    warnings: Object.freeze(warnings),
    featureName,
  });
};

