#!/usr/bin/env node

const assert = require("node:assert/strict");

async function main() {
  const {
    ACTION_IMPACT,
    EXECUTION_SCOPE,
    evaluateExecutionDecision,
    createExecutionLedgerState,
    appendExecutionRecord,
  } = await import("../src/lib/irreversibilityMapCore.js");

  const reversible = evaluateExecutionDecision({
    action_key: "experiment_toggle",
    action_impact: ACTION_IMPACT.REVERSIBLE,
    scope: EXECUTION_SCOPE.LOCAL_POD,
    invariants_passed: true,
    constitution_passed: true,
    auto_execute_requested: true,
  });
  assert.equal(reversible.status, "ALLOW", "Reversible action should allow execution when invariants pass.");
  assert.equal(reversible.allow_auto_execute, true, "Reversible action should allow auto-execution.");

  const irreversibleNoApproval = evaluateExecutionDecision({
    action_key: "data_delete",
    action_impact: ACTION_IMPACT.IRREVERSIBLE,
    scope: EXECUTION_SCOPE.SYSTEM,
    invariants_passed: true,
    constitution_passed: true,
    auto_execute_requested: false,
    human_approval: false,
    rationale: "",
    cooling_off_window: "",
    time_delay: "t+24h",
    time_delay_elapsed: true,
    drift_score: 0.9,
  });
  assert.equal(irreversibleNoApproval.status, "SAFE_HOLD", "Irreversible action without approval should SAFE_HOLD.");
  assert.ok(
    irreversibleNoApproval.reasons.includes("human_approval_required"),
    "Irreversible action must require human approval."
  );

  const misclassified = evaluateExecutionDecision({
    action_key: "data_delete",
    action_impact: ACTION_IMPACT.REVERSIBLE,
    scope: EXECUTION_SCOPE.LOCAL_POD,
    invariants_passed: true,
    constitution_passed: true,
    drift_score: 0.9,
  });
  assert.equal(misclassified.status, "SAFE_HOLD", "Misclassified impact should SAFE_HOLD.");
  assert.ok(misclassified.reasons.includes("impact_misclassified"), "Misclassified impact should be flagged.");

  const autoExecIrreversible = evaluateExecutionDecision({
    action_key: "policy_override",
    action_impact: ACTION_IMPACT.IRREVERSIBLE,
    scope: EXECUTION_SCOPE.SYSTEM,
    invariants_passed: true,
    constitution_passed: true,
    auto_execute_requested: true,
    human_approval: true,
    rationale: "Human-approved change",
    cooling_off_window: "t+24h",
    time_delay: "t+24h",
    time_delay_elapsed: true,
    drift_score: 0.9,
  });
  assert.equal(autoExecIrreversible.status, "SAFE_HOLD", "Auto-executing irreversible action should SAFE_HOLD.");
  assert.ok(
    autoExecIrreversible.reasons.includes("auto_execute_forbidden_for_irreversible"),
    "Auto-execution must be forbidden for irreversible actions."
  );

  const missingDrift = evaluateExecutionDecision({
    action_key: "governance_rule_change",
    action_impact: ACTION_IMPACT.IRREVERSIBLE,
    scope: EXECUTION_SCOPE.SYSTEM,
    invariants_passed: true,
    constitution_passed: true,
    human_approval: true,
    rationale: "Governance update",
    cooling_off_window: "t+48h",
    time_delay: "t+48h",
    time_delay_elapsed: true,
  });
  assert.equal(missingDrift.status, "SAFE_HOLD", "Missing drift score should SAFE_HOLD.");
  assert.ok(missingDrift.reasons.includes("drift_score_missing"), "Drift score is required for irreversible gates.");

  const missingDelay = evaluateExecutionDecision({
    action_key: "pod_merge",
    action_impact: ACTION_IMPACT.IRREVERSIBLE,
    scope: EXECUTION_SCOPE.CROSS_POD,
    invariants_passed: true,
    constitution_passed: true,
    human_approval: true,
    rationale: "Merge pods",
    cooling_off_window: "",
    drift_score: 0.9,
  });
  assert.equal(missingDelay.status, "SAFE_HOLD", "Scope above pod must require time delay.");
  assert.ok(missingDelay.reasons.includes("time_delay_required"), "Time delay must be enforced for cross-pod scope.");

  const ledgerBase = createExecutionLedgerState();
  const appended = appendExecutionRecord(ledgerBase, {
    action_key: "experiment_toggle",
    intent_id: "intent-099",
    action_impact: ACTION_IMPACT.REVERSIBLE,
    scope: EXECUTION_SCOPE.LOCAL_POD,
  });
  assert.equal(ledgerBase.records.length, 0, "Append-only ledger must not mutate base state.");
  assert.equal(appended.state.records.length, 1, "Execution record should be appended.");
  assert.equal(appended.state.records[0].action_impact, ACTION_IMPACT.REVERSIBLE, "Ledger must store ActionImpact.");

  console.log("Irreversibility selftest: PASS");
}

main().catch((err) => {
  console.error("\nIrreversibility selftest: FAIL");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
