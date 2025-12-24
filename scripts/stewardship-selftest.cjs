#!/usr/bin/env node

const assert = require("node:assert/strict");

async function main() {
  const {
    STEWARDSHIP_ROLE,
    EMERGENCY_ACTION,
    createStewardshipState,
    applyStewardshipHandoff,
    applyStewardshipReset,
    recordEmergencyAction,
    evaluateLaunchReadiness,
    evaluateStewardshipGuard,
    getStewardshipTransparency,
  } = await import("../src/lib/stewardshipCore.js");

  const baseState = createStewardshipState();

  const readinessFail = evaluateLaunchReadiness({
    constitution_loaded: true,
    constitution_immutable: true,
    invariants_verified: true,
    failure_simulations_passed: true,
    drift_score: 90,
    human_approval: true,
    approver_role: STEWARDSHIP_ROLE.FOUNDER_STEWARD,
    mock_mode: true,
  });
  assert.equal(readinessFail.status, "SAFE_HOLD", "Mock mode must block stewardship activation.");

  const handoffFail = applyStewardshipHandoff(baseState, {
    constitution_loaded: true,
    constitution_immutable: true,
    invariants_verified: true,
    failure_simulations_passed: true,
    drift_score: 90,
    human_approval: true,
    approver_role: STEWARDSHIP_ROLE.FOUNDER_STEWARD,
    mock_mode: true,
    explanation: "Attempted activation",
  });
  assert.equal(handoffFail.status, "SAFE_HOLD", "Handoff must SAFE_HOLD when readiness fails.");
  assert.equal(baseState.stewardship_active, false, "Base state must not mutate.");

  const handoff = applyStewardshipHandoff(baseState, {
    constitution_loaded: true,
    constitution_immutable: true,
    invariants_verified: true,
    failure_simulations_passed: true,
    drift_score: 90,
    human_approval: true,
    approver_role: STEWARDSHIP_ROLE.FOUNDER_STEWARD,
    mock_mode: false,
    explanation: "Go-live handoff",
  });
  assert.equal(handoff.status, "APPLIED", "Handoff should apply when readiness passes.");
  assert.equal(handoff.state.stewardship_active, true, "Stewardship must be active after handoff.");
  assert.equal(handoff.state.builder_privileges_removed, true, "Builder privileges must be removed.");
  assert.equal(baseState.log.length, 0, "Base log remains immutable.");

  const repeat = applyStewardshipHandoff(handoff.state, {
    constitution_loaded: true,
    constitution_immutable: true,
    invariants_verified: true,
    failure_simulations_passed: true,
    drift_score: 90,
    human_approval: true,
    approver_role: STEWARDSHIP_ROLE.FOUNDER_STEWARD,
    mock_mode: false,
    explanation: "Second attempt",
  });
  assert.equal(repeat.status, "SAFE_HOLD", "Repeat handoff must SAFE_HOLD.");

  const guardFail = evaluateStewardshipGuard({
    stewardship_active: true,
    action_impact: "IRREVERSIBLE",
    human_approval: false,
    actor_role: STEWARDSHIP_ROLE.MAINTENANCE_BOT,
    invariants_passed: true,
    constitution_passed: true,
  });
  assert.equal(guardFail.ok, false, "Maintenance Bot cannot approve irreversible actions.");

  let emergencyError = null;
  try {
    recordEmergencyAction(handoff.state, {
      actor_role: STEWARDSHIP_ROLE.SYSTEM_STEWARD,
      emergency_action: EMERGENCY_ACTION.SAFE_HOLD,
      explanation: "",
    });
  } catch (err) {
    emergencyError = err;
  }
  assert.ok(emergencyError, "Emergency actions require explanations.");

  const emergency = recordEmergencyAction(handoff.state, {
    actor_role: STEWARDSHIP_ROLE.SYSTEM_STEWARD,
    emergency_action: EMERGENCY_ACTION.SAFE_HOLD,
    explanation: "Containment mode",
  });
  assert.equal(emergency.state.log.length, handoff.state.log.length + 1, "Emergency action must be logged.");

  const resetFail = applyStewardshipReset(handoff.state, {
    actor_role: STEWARDSHIP_ROLE.MAINTENANCE_BOT,
    explanation: "Unauthorized reset",
    human_approval: false,
  });
  assert.equal(resetFail.status, "SAFE_HOLD", "Reset requires human stewardship approval.");

  const transparency = getStewardshipTransparency();
  assert.ok(transparency.constitution_summary.purpose, "Transparency artifacts must include constitution summary.");
  assert.ok(Array.isArray(transparency.never_optimize_for), "Transparency artifacts must include non-goals.");

  console.log("Stewardship handoff selftest: PASS");
}

main().catch((err) => {
  console.error("\nStewardship handoff selftest: FAIL");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
