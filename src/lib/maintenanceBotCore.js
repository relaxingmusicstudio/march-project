import { CIV_CONSTITUTION } from "./policy/constitutionCore.js";
import { REQUIRED_INVARIANTS } from "./policy/invariantsCore.js";
import { evaluatePolicy } from "./policy/policyEngineCore.js";

const MAINTENANCE_FORBIDDEN_OPTIMIZATION_TARGETS = Object.freeze(["growth", "profit", "engagement"]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeStringArray = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];

const unique = (values) => Array.from(new Set(values));

const toBool = (value) => value === true;

const freezeMessages = (messages) => Object.freeze(messages.map((msg) => Object.freeze({ ...msg })));

const makeMessage = (id, message) => Object.freeze({ id, message });

const forbiddenTargets = () =>
  unique([...CIV_CONSTITUTION.nonGoals, ...MAINTENANCE_FORBIDDEN_OPTIMIZATION_TARGETS])
    .map(normalizeText)
    .filter(Boolean);

const findForbiddenTargets = (targets) => {
  const normalizedTargets = normalizeStringArray(targets);
  const forbidden = forbiddenTargets();
  const hits = [];

  for (const target of normalizedTargets) {
    const normalizedTarget = normalizeText(target);
    if (!normalizedTarget) continue;
    if (forbidden.some((item) => normalizedTarget === item || normalizedTarget.includes(item))) {
      hits.push(target);
    }
  }

  return hits;
};

export const MAINTENANCE_BOT_RULES = Object.freeze({
  canObserve: true,
  canEvaluate: true,
  canReport: true,
  canModifyData: false,
  canTriggerActions: false,
  canOverrideHumans: false,
  forbiddenOptimizations: MAINTENANCE_FORBIDDEN_OPTIMIZATION_TARGETS,
});

const resolveIntentAllowance = ({ intentsPresent, mockMode, allowIntentlessInMock }) => {
  if (!intentsPresent && mockMode && allowIntentlessInMock) {
    return { intentsPresent: true, intentViolation: false, intentWarning: true };
  }
  return { intentsPresent, intentViolation: !intentsPresent, intentWarning: false };
};

export const evaluateInvariantViolations = (input) => {
  const intentsPresent = toBool(input?.intentsPresent);
  const appendOnlyPreserved = toBool(input?.appendOnlyPreserved);
  const mockMode = toBool(input?.mockMode);
  const allowIntentlessInMock = toBool(input?.allowIntentlessInMock);
  const centralControlDetected = toBool(input?.centralControlDetected);
  const authorityBypassDetected = toBool(input?.authorityBypassDetected);
  const claimsWithoutEvidenceDetected = toBool(input?.claimsWithoutEvidenceDetected);
  const evidenceMissing = toBool(input?.evidenceMissing);
  const requiresHumanApprovalForR3 = toBool(input?.requiresHumanApprovalForR3);

  const intentCheck = resolveIntentAllowance({ intentsPresent, mockMode, allowIntentlessInMock });

  const violations = [];
  const warnings = [];

  const invariantChecks = {
    no_central_control: () =>
      centralControlDetected
        ? makeMessage(
            "invariant::no_central_control",
            "Central control signal detected; maintenance bot must not permit capture."
          )
        : null,
    intent_before_action: () => {
      if (intentCheck.intentViolation) {
        return makeMessage(
          "invariant::intent_before_action",
          "Intent binding missing; actions must remain traceable to declared intent."
        );
      }
      if (intentCheck.intentWarning) {
        return makeMessage(
          "invariant::intent_before_action:mock-allowed",
          "Intent binding missing but explicitly allowed in mock mode."
        );
      }
      return null;
    },
    authority_decays_without_contribution: () => {
      if (authorityBypassDetected) {
        return makeMessage(
          "invariant::authority_decays_without_contribution",
          "Authority bypass detected; approvals must remain accountable."
        );
      }
      if (!requiresHumanApprovalForR3) {
        return makeMessage(
          "invariant::authority_decays_without_contribution:approval-missing",
          "Human approval plumbing is not enforced for high-risk changes."
        );
      }
      return null;
    },
    knowledge_over_position: () => {
      if (claimsWithoutEvidenceDetected) {
        return makeMessage(
          "invariant::knowledge_over_position",
          "Claims without evidence detected; knowledge must stay verifiable."
        );
      }
      if (evidenceMissing) {
        return makeMessage(
          "invariant::knowledge_over_position:missing-evidence",
          "Evidence signals missing; verify sources before escalation."
        );
      }
      return null;
    },
  };

  for (const invariant of REQUIRED_INVARIANTS) {
    const check = invariantChecks[invariant.id];
    if (!check) {
      warnings.push(
        makeMessage(
          "invariant::coverage-gap",
          `Invariant ${invariant.id} has no explicit maintenance check wired yet.`
        )
      );
      continue;
    }
    const result = check();
    if (!result) continue;
    if (result.id.includes("approval-missing") || result.id.includes("missing-evidence") || result.id.includes(":mock-allowed")) {
      warnings.push(result);
    } else {
      violations.push(result);
    }
  }

  if (!appendOnlyPreserved) {
    violations.push(
      makeMessage("invariant::append-only-required", "Append-only guarantees must be preserved; destructive edits detected.")
    );
  }

  return Object.freeze({
    violations: freezeMessages(violations),
    warnings: freezeMessages(warnings),
  });
};

export const computeDriftScore = (input) => {
  const invariantViolationsCount = Number(input?.invariantViolationsCount ?? 0);
  const prohibitedTargetHitsCount = Number(input?.prohibitedTargetHitsCount ?? 0);
  const missingIntentCount = Number(input?.missingIntentCount ?? 0);
  const appendOnlyBreachCount = Number(input?.appendOnlyBreachCount ?? 0);
  const missingApprovalCount = Number(input?.missingApprovalCount ?? 0);

  const lineItems = [];

  const pushLine = (id, label, weight, count, penalty, explanation) => {
    lineItems.push(
      Object.freeze({
        id,
        label,
        weight,
        count,
        penalty,
        explanation,
      })
    );
  };

  const invariantPenalty = invariantViolationsCount > 0 ? 35 : 0;
  pushLine(
    "drift::invariants",
    "Invariant violations",
    35,
    invariantViolationsCount,
    invariantPenalty,
    invariantViolationsCount > 0
      ? `Detected ${invariantViolationsCount} invariant violation(s).`
      : "No invariant violations detected."
  );

  const prohibitedPenalty = prohibitedTargetHitsCount > 0 ? 25 : 0;
  pushLine(
    "drift::prohibited-targets",
    "Prohibited optimization targets",
    25,
    prohibitedTargetHitsCount,
    prohibitedPenalty,
    prohibitedTargetHitsCount > 0
      ? `Detected ${prohibitedTargetHitsCount} prohibited target hit(s).`
      : "No prohibited optimization targets detected."
  );

  const intentPenalty = missingIntentCount > 0 ? 20 : 0;
  pushLine(
    "drift::intent",
    "Intent bindings",
    20,
    missingIntentCount,
    intentPenalty,
    missingIntentCount > 0 ? "Intent binding missing." : "Intent binding present."
  );

  const appendPenalty = appendOnlyBreachCount > 0 ? 15 : 0;
  pushLine(
    "drift::append-only",
    "Append-only guarantees",
    15,
    appendOnlyBreachCount,
    appendPenalty,
    appendOnlyBreachCount > 0 ? "Append-only breach detected." : "Append-only history preserved."
  );

  const approvalPenalty = missingApprovalCount > 0 ? 5 : 0;
  pushLine(
    "drift::human-approval",
    "Human approval wiring",
    5,
    missingApprovalCount,
    approvalPenalty,
    missingApprovalCount > 0 ? "Human approval wiring missing." : "Human approval wiring present."
  );

  const totalPenalty = lineItems.reduce((sum, item) => sum + item.penalty, 0);
  const score = clamp(100 - totalPenalty, 0, 100);

  return Object.freeze({
    score,
    lines: Object.freeze(lineItems),
  });
};

const buildRecommendations = (lines) => {
  const recommendations = [];
  for (const line of lines) {
    if (line.penalty === 0) continue;
    recommendations.push(`Observation: ${line.label} flagged (${line.count}).`);
  }
  if (recommendations.length === 0) {
    recommendations.push("Observation: no drift indicators detected.");
  }
  return Object.freeze(recommendations);
};

export const buildMaintenanceReport = (input) => {
  const featureName = isNonEmptyString(input?.featureName) ? input.featureName.trim() : "unknown";
  const timestamp = isNonEmptyString(input?.timestamp) ? input.timestamp.trim() : "timestamp_missing";
  const declaredOptimizationTargets = normalizeStringArray(input?.declaredOptimizationTargets);
  const intentsPresent = toBool(input?.intentsPresent);
  const appendOnlyPreserved = toBool(input?.appendOnlyPreserved);
  const requiresHumanApprovalForR3 = toBool(input?.requiresHumanApprovalForR3);
  const mockMode = toBool(input?.mockMode);
  const allowIntentlessInMock = toBool(input?.allowIntentlessInMock);

  const policy = evaluatePolicy({
    featureName,
    declaredOptimizationTargets,
    intentsPresent,
    appendOnlyPreserved,
    requiresHumanApprovalForR3,
    mockMode,
    allowIntentlessInMock,
  });

  const invariantResult = evaluateInvariantViolations({
    intentsPresent,
    appendOnlyPreserved,
    mockMode,
    allowIntentlessInMock,
    centralControlDetected: toBool(input?.centralControlDetected),
    authorityBypassDetected: toBool(input?.authorityBypassDetected),
    claimsWithoutEvidenceDetected: toBool(input?.claimsWithoutEvidenceDetected),
    evidenceMissing: toBool(input?.evidenceMissing),
    requiresHumanApprovalForR3,
  });

  const forbiddenTargets = findForbiddenTargets(declaredOptimizationTargets);

  const intentCheck = resolveIntentAllowance({ intentsPresent, mockMode, allowIntentlessInMock });
  const drift = computeDriftScore({
    invariantViolationsCount: invariantResult.violations.length,
    prohibitedTargetHitsCount: forbiddenTargets.length,
    missingIntentCount: intentCheck.intentViolation ? 1 : 0,
    appendOnlyBreachCount: appendOnlyPreserved ? 0 : 1,
    missingApprovalCount: requiresHumanApprovalForR3 ? 0 : 1,
  });

  const warnings = [
    ...policy.warnings,
    ...policy.violations.map((item) => makeMessage(item.id, `Violation: ${item.message}`)),
    ...invariantResult.warnings,
    ...forbiddenTargets.map((target) =>
      makeMessage("maintenance::forbidden-optimization-target", `Violation: Forbidden optimization target "${target}".`)
    ),
  ];

  const report = {
    version: "v1",
    timestamp,
    drift_score: drift,
    invariant_violations: invariantResult.violations,
    warnings: freezeMessages(warnings),
    recommendations: buildRecommendations(drift.lines),
  };

  return Object.freeze(report);
};

export const appendMaintenanceReport = (history, report, limit = 50) => {
  const base = Array.isArray(history) ? history.slice() : [];
  const next = [...base, report].slice(-limit);
  return Object.freeze(next);
};

export const getSafeModeFallback = (reason) =>
  Object.freeze({
    mode: "SAFE_MODE",
    reason: isNonEmptyString(reason) ? reason.trim() : "maintenance_bot_failure",
    automationAllowed: false,
    escalationAllowed: false,
    requiresHumanIntervention: true,
  });

export const evaluateMaintenancePreflight = (input) => {
  const featureName = isNonEmptyString(input?.featureName) ? input.featureName.trim() : "";
  const declaredOptimizationTargets = normalizeStringArray(input?.declaredOptimizationTargets);
  const intentsPresent = toBool(input?.intentsPresent);
  const appendOnlyPreserved = toBool(input?.appendOnlyPreserved);
  const requiresHumanApprovalForR3 = toBool(input?.requiresHumanApprovalForR3);
  const mockMode = toBool(input?.mockMode);
  const allowIntentlessInMock = toBool(input?.allowIntentlessInMock);

  const reasons = [];
  if (!featureName) {
    reasons.push("featureName is required for maintenance preflight.");
  }

  const policy = evaluatePolicy({
    featureName: featureName || "unknown",
    declaredOptimizationTargets,
    intentsPresent,
    appendOnlyPreserved,
    requiresHumanApprovalForR3,
    mockMode,
    allowIntentlessInMock,
  });

  const invariantResult = evaluateInvariantViolations({
    intentsPresent,
    appendOnlyPreserved,
    mockMode,
    allowIntentlessInMock,
    centralControlDetected: toBool(input?.centralControlDetected),
    authorityBypassDetected: toBool(input?.authorityBypassDetected),
    claimsWithoutEvidenceDetected: toBool(input?.claimsWithoutEvidenceDetected),
    evidenceMissing: toBool(input?.evidenceMissing),
    requiresHumanApprovalForR3,
  });

  for (const violation of policy.violations) {
    reasons.push(violation.message);
  }

  for (const violation of invariantResult.violations) {
    reasons.push(violation.message);
  }

  const forbiddenHits = findForbiddenTargets(declaredOptimizationTargets);
  if (forbiddenHits.length > 0) {
    reasons.push(`Forbidden optimization target(s): ${forbiddenHits.map((t) => `"${t}"`).join(", ")}.`);
  }

  const status = reasons.length > 0 ? "FAIL" : "PASS";
  const terminalOutcome = status === "PASS" ? "executed" : "halted";

  return Object.freeze({
    status,
    reasons: Object.freeze(reasons),
    safeMode: status === "FAIL",
    requiresHumanIntervention: status === "FAIL",
    terminal_outcome: terminalOutcome,
  });
};
