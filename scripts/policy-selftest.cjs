#!/usr/bin/env node

const assert = require("node:assert/strict");

const REQUIRED_IDS = [
  "no_central_control",
  "intent_before_action",
  "authority_decays_without_contribution",
  "knowledge_over_position",
];

const inRange01 = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

async function main() {
  const { REQUIRED_INVARIANTS } = await import("../src/lib/policy/invariantsCore.js");
  const { CIV_CONSTITUTION } = await import("../src/lib/policy/constitutionCore.js");
  const { evaluatePolicy } = await import("../src/lib/policy/policyEngineCore.js");
  const { computeDriftScore } = await import("../src/lib/policy/driftScoreCore.js");
  const { buildMaintenanceReport } = await import("../src/lib/policy/reportCore.js");

  assert(Array.isArray(REQUIRED_INVARIANTS), "REQUIRED_INVARIANTS must be an array.");
  assert(REQUIRED_INVARIANTS.length >= 4, "REQUIRED_INVARIANTS must have >= 4 entries.");

  const ids = REQUIRED_INVARIANTS.map((inv) => inv?.id).filter(Boolean);
  for (const required of REQUIRED_IDS) {
    assert(ids.includes(required), `Missing required invariant id "${required}".`);
  }

  assert(typeof CIV_CONSTITUTION?.purpose === "string" && CIV_CONSTITUTION.purpose.trim().length > 0, "Constitution purpose must be non-empty.");
  assert(Array.isArray(CIV_CONSTITUTION?.nonGoals) && CIV_CONSTITUTION.nonGoals.length > 0, "Constitution nonGoals must be non-empty.");

  const prohibitedSample = CIV_CONSTITUTION.nonGoals[0];
  const policyResult = evaluatePolicy({
    featureName: "policy-selftest",
    declaredOptimizationTargets: [prohibitedSample],
    intentsPresent: true,
    appendOnlyPreserved: true,
    requiresHumanApprovalForR3: true,
  });

  assert(policyResult && policyResult.ok === false, "Policy engine must reject prohibited optimization targets.");
  assert(Array.isArray(policyResult.violations) && policyResult.violations.length > 0, "Policy engine must return violations when blocking.");

  const driftHealthy = computeDriftScore({
    invariantViolationsCount: 0,
    prohibitedTargetHitsCount: 0,
    missingIntentCount: 0,
    missingApprovalCount: 0,
  });
  assert(inRange01(driftHealthy), "Drift score must be in [0,1] for healthy case.");

  const driftBad = computeDriftScore({
    invariantViolationsCount: 1,
    prohibitedTargetHitsCount: 1,
    missingIntentCount: 5,
    missingApprovalCount: 5,
  });
  assert(inRange01(driftBad), "Drift score must be in [0,1] for degraded case.");
  assert(driftBad < driftHealthy, "Drift score should decrease as violations increase.");

  const report = buildMaintenanceReport({
    featureName: "policy-selftest",
    declaredOptimizationTargets: [],
    intentsPresent: true,
    appendOnlyPreserved: true,
    requiresHumanApprovalForR3: false,
    driftInputs: {
      invariantViolationsCount: 0,
      prohibitedTargetHitsCount: 0,
      missingIntentCount: 0,
      missingApprovalCount: 1,
    },
  });

  assert(report?.version === "v1", "Maintenance report must have version v1.");
  assert(typeof report?.constitution?.purpose === "string" && report.constitution.purpose.length > 0, "Report must include constitution purpose.");
  assert(Array.isArray(report?.constitution?.nonGoals) && report.constitution.nonGoals.length > 0, "Report must include nonGoals.");
  assert(inRange01(report?.drift?.score), "Report drift.score must be in [0,1].");

  console.log("Policy selftest: PASS");
  console.log(`- invariants: ${ids.length} (required: ${REQUIRED_IDS.join(", ")})`);
  console.log(`- nonGoals: ${CIV_CONSTITUTION.nonGoals.length}`);
  console.log(`- drift: healthy=${driftHealthy.toFixed(2)} degraded=${driftBad.toFixed(2)}`);
}

main().catch((err) => {
  console.error("\nPolicy selftest: FAIL");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});

