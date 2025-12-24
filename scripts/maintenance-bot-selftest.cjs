#!/usr/bin/env node

const assert = require("node:assert/strict");

async function main() {
  const {
    computeDriftScore,
    evaluateInvariantViolations,
    evaluateMaintenancePreflight,
    buildMaintenanceReport,
    appendMaintenanceReport,
  } = await import("../src/lib/maintenanceBotCore.js");

  const healthyDrift = computeDriftScore({
    invariantViolationsCount: 0,
    prohibitedTargetHitsCount: 0,
    missingIntentCount: 0,
    appendOnlyBreachCount: 0,
    missingApprovalCount: 0,
  });
  assert.equal(healthyDrift.score, 100, "Healthy drift score should be 100.");
  assert.ok(Array.isArray(healthyDrift.lines), "Drift score lines must be present.");

  const maxDrift = computeDriftScore({
    invariantViolationsCount: 1,
    prohibitedTargetHitsCount: 1,
    missingIntentCount: 1,
    appendOnlyBreachCount: 1,
    missingApprovalCount: 1,
  });
  assert.equal(maxDrift.score, 0, "Max drift penalties should yield 0 score.");

  const invariantCheck = evaluateInvariantViolations({
    intentsPresent: true,
    appendOnlyPreserved: true,
    requiresHumanApprovalForR3: true,
    centralControlDetected: true,
  });
  assert.ok(
    invariantCheck.violations.some((v) => v.id === "invariant::no_central_control"),
    "Invariant violations must include no_central_control when signaled."
  );

  const passPreflight = evaluateMaintenancePreflight({
    featureName: "safe-change",
    declaredOptimizationTargets: [],
    intentsPresent: true,
    appendOnlyPreserved: true,
    requiresHumanApprovalForR3: true,
  });
  assert.equal(passPreflight.status, "PASS", "Preflight should pass for safe inputs.");

  const failPreflight = evaluateMaintenancePreflight({
    featureName: "unsafe-change",
    declaredOptimizationTargets: ["maximize engagement"],
    intentsPresent: true,
    appendOnlyPreserved: true,
    requiresHumanApprovalForR3: true,
  });
  assert.equal(failPreflight.status, "FAIL", "Preflight should fail for prohibited targets.");

  const intentFail = evaluateMaintenancePreflight({
    featureName: "intent-missing",
    declaredOptimizationTargets: [],
    intentsPresent: false,
    appendOnlyPreserved: true,
    requiresHumanApprovalForR3: true,
    mockMode: false,
  });
  assert.equal(intentFail.status, "FAIL", "Preflight should fail when intent is missing.");

  const report = buildMaintenanceReport({
    featureName: "report-check",
    timestamp: "t1",
    declaredOptimizationTargets: [],
    intentsPresent: true,
    appendOnlyPreserved: true,
    requiresHumanApprovalForR3: true,
  });
  assert.equal(report.timestamp, "t1", "Report must preserve provided timestamp.");

  const history = [];
  const nextHistory = appendMaintenanceReport(history, report, 5);
  assert.equal(history.length, 0, "Append-only helper must not mutate prior history.");
  assert.equal(nextHistory.length, 1, "Append-only helper must append report.");

  console.log("Maintenance bot selftest: PASS");
}

main().catch((err) => {
  console.error("\nMaintenance bot selftest: FAIL");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
