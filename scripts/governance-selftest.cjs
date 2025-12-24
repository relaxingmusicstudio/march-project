#!/usr/bin/env node

const assert = require("node:assert/strict");

async function main() {
  const {
    GOVERNANCE_SCOPE,
    GOVERNANCE_INITIATOR,
    createGovernanceState,
    appendGovernanceDecision,
    canExecuteDecision,
    evaluateGovernanceState,
  } = await import("../src/lib/governanceModelCore.js");

  const baseState = createGovernanceState();

  const first = appendGovernanceDecision(baseState, {
    scope: GOVERNANCE_SCOPE.LOCAL_POD,
    initiator: GOVERNANCE_INITIATOR.POD,
    justification: "Local pod rollout scope",
    affected_invariants: ["intent_before_action"],
    requires_human_approval: false,
    intent_id: "intent-001",
    pod_id: "pod-alpha",
  });

  assert.equal(baseState.decisions.length, 0, "Append-only: base state must not be mutated.");
  assert.equal(first.state.decisions.length, 1, "Append-only: decision should be appended.");

  const otherPodExecution = canExecuteDecision(first.decision, {
    initiator: GOVERNANCE_INITIATOR.POD,
    pod_id: "pod-beta",
  });
  assert.equal(otherPodExecution.ok, false, "Pods cannot override decisions outside their pod.");

  let crossPodError = null;
  try {
    appendGovernanceDecision(first.state, {
      scope: GOVERNANCE_SCOPE.CROSS_POD,
      initiator: GOVERNANCE_INITIATOR.POD,
      justification: "Cross pod proposal",
      affected_invariants: ["intent_before_action"],
      requires_human_approval: false,
      intent_id: "intent-002",
      pod_id: "pod-alpha",
      target_pod_ids: ["pod-beta"],
    });
  } catch (err) {
    crossPodError = err;
  }
  assert.ok(crossPodError, "Cross-pod decisions must require human approval.");

  const decisionA = appendGovernanceDecision(first.state, {
    scope: GOVERNANCE_SCOPE.LOCAL_POD,
    initiator: GOVERNANCE_INITIATOR.POD,
    justification: "Option A",
    affected_invariants: ["intent_before_action"],
    requires_human_approval: false,
    intent_id: "intent-a",
    pod_id: "pod-alpha",
    decision_key: "policy:conflict",
  });

  const decisionB = appendGovernanceDecision(decisionA.state, {
    scope: GOVERNANCE_SCOPE.LOCAL_POD,
    initiator: GOVERNANCE_INITIATOR.POD,
    justification: "Option B",
    affected_invariants: ["intent_before_action"],
    requires_human_approval: false,
    intent_id: "intent-b",
    pod_id: "pod-alpha",
    decision_key: "policy:conflict",
  });

  const governanceState = evaluateGovernanceState(decisionB.state.decisions);
  assert.equal(governanceState.mode, "SAFE_HOLD", "Conflicting decisions must trigger SAFE_HOLD.");

  let forbiddenError = null;
  try {
    appendGovernanceDecision(decisionB.state, {
      scope: GOVERNANCE_SCOPE.LOCAL_POD,
      initiator: GOVERNANCE_INITIATOR.HUMAN,
      justification: "Prohibited optimization attempt",
      affected_invariants: ["knowledge_over_position"],
      requires_human_approval: false,
      intent_id: "intent-003",
      pod_id: "pod-alpha",
      declared_optimization_targets: ["maximize engagement"],
    });
  } catch (err) {
    forbiddenError = err;
  }
  assert.ok(forbiddenError, "Invariants cannot be bypassed via governance.");

  console.log("Governance selftest: PASS");
}

main().catch((err) => {
  console.error("\nGovernance selftest: FAIL");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
