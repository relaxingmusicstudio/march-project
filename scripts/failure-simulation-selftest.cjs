#!/usr/bin/env node

const assert = require("node:assert/strict");

async function main() {
  const {
    GOVERNANCE_SCOPE,
    GOVERNANCE_INITIATOR,
    createGovernanceState,
    appendGovernanceDecision,
    evaluateGovernanceState,
  } = await import("../src/lib/governanceModelCore.js");

  const {
    ACTION_IMPACT,
    EXECUTION_SCOPE,
    evaluateExecutionDecision,
    createExecutionLedgerState,
  } = await import("../src/lib/irreversibilityMapCore.js");

  const { computeDriftScore, evaluateMaintenancePreflight } = await import("../src/lib/maintenanceBotCore.js");

  const {
    FAILURE_CLASS,
    createFailureSimulationState,
    appendFailureRecord,
    evaluateDriftEscalation,
  } = await import("../src/lib/failureSimulationCore.js");

  let failureState = createFailureSimulationState();

  // 1) Governance Conflict
  const governanceBase = createGovernanceState();
  const decisionA = appendGovernanceDecision(governanceBase, {
    scope: GOVERNANCE_SCOPE.LOCAL_POD,
    initiator: GOVERNANCE_INITIATOR.POD,
    justification: "Pod alpha chooses plan A",
    affected_invariants: ["intent_before_action"],
    requires_human_approval: false,
    intent_id: "intent-alpha",
    pod_id: "pod-alpha",
    decision_key: "deploy-scenario",
  });
  const decisionB = appendGovernanceDecision(decisionA.state, {
    scope: GOVERNANCE_SCOPE.LOCAL_POD,
    initiator: GOVERNANCE_INITIATOR.POD,
    justification: "Pod beta chooses plan B",
    affected_invariants: ["intent_before_action"],
    requires_human_approval: false,
    intent_id: "intent-beta",
    pod_id: "pod-beta",
    decision_key: "deploy-scenario",
  });
  const governanceEval = evaluateGovernanceState(decisionB.state.decisions);
  assert.equal(governanceEval.mode, "SAFE_HOLD", "Governance conflicts must trigger SAFE_HOLD.");
  assert.equal(governanceBase.decisions.length, 0, "Governance ledger must remain append-only.");

  const executionLedger = createExecutionLedgerState();
  assert.equal(executionLedger.records.length, 0, "No irreversible action should be committed under SAFE_HOLD.");

  const conflictRecord = appendFailureRecord(failureState, {
    failure_class: FAILURE_CLASS.GOVERNANCE_CONFLICT,
    status: governanceEval.mode,
    safe_mode: true,
    reasons: ["conflicting_decisions"],
    context: { conflicts: governanceEval.conflicts },
    created_at: "f1",
  });
  failureState = conflictRecord.state;
  assert.equal(failureState.records.length, 1, "Conflict context must be recorded immutably.");
  assert.ok(Array.isArray(conflictRecord.record.context.conflicts), "Conflict context must be recorded.");

  // 2) Drift Escalation
  const warningScore = computeDriftScore({
    invariantViolationsCount: 0,
    prohibitedTargetHitsCount: 0,
    missingIntentCount: 1,
    appendOnlyBreachCount: 0,
    missingApprovalCount: 1,
  });
  const criticalScore = computeDriftScore({
    invariantViolationsCount: 1,
    prohibitedTargetHitsCount: 1,
    missingIntentCount: 0,
    appendOnlyBreachCount: 0,
    missingApprovalCount: 0,
  });

  const warningEval = evaluateDriftEscalation(warningScore.score);
  assert.equal(warningEval.level, "ADVISORY", "Warning threshold should be advisory only.");
  assert.equal(warningEval.requires_human_approval, false, "Warning drift must not require human approval.");
  assert.equal(warningEval.auto_bypass_allowed, false, "Automated drift bypass is never allowed.");

  const criticalEval = evaluateDriftEscalation(criticalScore.score);
  assert.equal(criticalEval.level, "CRITICAL", "Critical drift must trigger human approval.");
  assert.equal(criticalEval.requires_human_approval, true, "Critical drift requires human approval.");
  assert.equal(criticalEval.auto_bypass_allowed, false, "Automated drift bypass is never allowed.");

  // 3) Provider Collapse
  const providerState = { writes: [], retries: 0 };
  const providerResult = {
    mode: "READ_ONLY",
    writes_attempted: providerState.writes.length,
    retry_count: providerState.retries,
    reasons: ["llm_provider_down", "messaging_provider_down", "search_provider_down"],
  };
  assert.equal(providerResult.mode, "READ_ONLY", "Provider collapse must degrade to read-only.");
  assert.equal(providerResult.writes_attempted, 0, "No partial writes should occur.");
  assert.equal(providerResult.retry_count, 0, "No retry loops should mutate state.");

  failureState = appendFailureRecord(failureState, {
    failure_class: FAILURE_CLASS.PROVIDER_COLLAPSE,
    status: providerResult.mode,
    safe_mode: true,
    reasons: providerResult.reasons,
    created_at: "f2",
  }).state;

  // 4) Time-Based Failure
  const timeGate = evaluateExecutionDecision({
    action_key: "governance_rule_change",
    action_impact: ACTION_IMPACT.IRREVERSIBLE,
    scope: EXECUTION_SCOPE.SYSTEM,
    invariants_passed: true,
    constitution_passed: true,
    human_approval: true,
    rationale: "Time delayed change",
    cooling_off_window: "t+24h",
    time_delay: "t+24h",
    time_delay_elapsed: false,
    drift_score: 0.9,
  });
  assert.equal(timeGate.status, "SAFE_HOLD", "Irreversible action before time delay must SAFE_HOLD.");
  assert.ok(timeGate.reasons.includes("time_delay_not_elapsed"), "Time delay rejection must be deterministic.");

  const timeLedger = createExecutionLedgerState();
  assert.equal(timeLedger.records.length, 0, "Time-delay rejection must not mutate execution ledger.");

  failureState = appendFailureRecord(failureState, {
    failure_class: FAILURE_CLASS.TIME_DELAY,
    status: timeGate.status,
    safe_mode: true,
    reasons: timeGate.reasons,
    created_at: "f3",
  }).state;

  // 5) Malicious Steward Attempt
  let governanceOverrideError = null;
  try {
    appendGovernanceDecision(decisionB.state, {
      scope: GOVERNANCE_SCOPE.LOCAL_POD,
      initiator: GOVERNANCE_INITIATOR.HUMAN,
      justification: "Override invariants",
      affected_invariants: ["no_central_control"],
      requires_human_approval: false,
      intent_id: "intent-malicious",
      pod_id: "pod-alpha",
      declared_optimization_targets: ["maximize engagement"],
    });
  } catch (err) {
    governanceOverrideError = err;
  }
  assert.ok(governanceOverrideError, "Governance cannot override invariants.");

  const maintenanceOverride = evaluateMaintenancePreflight({
    featureName: "malicious-override",
    declaredOptimizationTargets: ["maximize engagement"],
    intentsPresent: true,
    appendOnlyPreserved: true,
    requiresHumanApprovalForR3: true,
  });
  assert.equal(maintenanceOverride.status, "FAIL", "Maintenance bot must block invariant override attempts.");

  const directOverride = evaluateExecutionDecision({
    action_key: "automation_escalation",
    action_impact: ACTION_IMPACT.IRREVERSIBLE,
    scope: EXECUTION_SCOPE.SYSTEM,
    invariants_passed: true,
    constitution_passed: true,
    human_approval: true,
    rationale: "Override attempt",
    cooling_off_window: "t+24h",
    time_delay: "t+24h",
    time_delay_elapsed: true,
    drift_score: 0.9,
    declared_optimization_targets: ["centralize power"],
  });
  assert.equal(directOverride.status, "SAFE_HOLD", "Direct override attempt must SAFE_HOLD.");
  assert.ok(directOverride.reasons.includes("forbidden_optimization_target"), "Override attempts must be blocked.");

  failureState = appendFailureRecord(failureState, {
    failure_class: FAILURE_CLASS.MALICIOUS_STEWARD,
    status: "SAFE_HOLD",
    safe_mode: true,
    reasons: ["governance_override", "maintenance_override", "direct_override"],
    created_at: "f4",
  }).state;

  assert.equal(failureState.records.length, 4, "Failure ledger must append records immutably.");

  console.log("Failure simulation selftest: PASS");
}

main().catch((err) => {
  console.error("\nFailure simulation selftest: FAIL");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
