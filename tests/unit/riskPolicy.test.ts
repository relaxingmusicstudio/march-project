import { describe, expect, it } from "vitest";
import { evaluateAssumptions, evaluateRiskGate, scoreIntentRisk } from "../../src/kernel/riskPolicy";

describe("riskPolicy", () => {
  it("scores analytics intents as low risk by default", () => {
    const assessment = scoreIntentRisk("analytics.track_event", {});
    expect(assessment.level).toBe("low");
    expect(assessment.budgetCents).toBeGreaterThan(0);
  });

  it("returns noop when risk exceeds tolerance", () => {
    const gate = evaluateRiskGate("memory.save", {}, { riskTolerance: 0.1 });
    expect(gate.action).toBe("noop");
    expect(gate.reasonCode).toBe("risk_threshold_exceeded");
  });

  it("fails assumptions when expired", () => {
    const result = evaluateAssumptions({
      assumptions: [{ key: "test", validatedAt: "2024-01-01T00:00:00.000Z", expiresAt: "2024-01-02T00:00:00.000Z" }],
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe("assumption_expired");
  });
});
