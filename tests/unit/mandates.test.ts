import { describe, expect, it } from "vitest";
import {
  signMandatePayload,
  validateMandateToken,
  type MandatePayload,
} from "../../src/kernel/mandates";

const buildPayload = (overrides: Partial<MandatePayload> = {}): MandatePayload => {
  const now = new Date();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 60_000).toISOString();
  return {
    mandateId: "mandate-1",
    intent: "analytics.track_event",
    scope: "external_effect",
    issuedAt,
    expiresAt,
    riskLevel: "high",
    minApprovals: 2,
    approvals: [
      { approverId: "human-1", approvedAt: issuedAt, role: "owner" },
      { approverId: "human-2", approvedAt: issuedAt, role: "security" },
    ],
    rationale: "High-risk action approval.",
    ...overrides,
  };
};

describe("mandate validation", () => {
  it("accepts signed mandates with multi-human approvals", async () => {
    const secret = "test-secret";
    const payload = buildPayload();
    const signed = await signMandatePayload(payload, secret);
    expect(signed.ok).toBe(true);
    const token = { payload, signature: signed.signature, alg: "HMAC-SHA256" } as const;
    const result = await validateMandateToken(token, {
      expectedIntent: "analytics.track_event",
      minApprovals: 2,
      minRiskLevel: "high",
      secret,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects insufficient approvals", async () => {
    const secret = "test-secret";
    const payload = buildPayload({ approvals: [{ approverId: "human-1", approvedAt: new Date().toISOString() }] });
    const signed = await signMandatePayload(payload, secret);
    const token = { payload, signature: signed.signature, alg: "HMAC-SHA256" } as const;
    const result = await validateMandateToken(token, {
      expectedIntent: "analytics.track_event",
      minApprovals: 2,
      minRiskLevel: "high",
      secret,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("approvals_insufficient");
  });

  it("rejects invalid signatures", async () => {
    const secret = "test-secret";
    const payload = buildPayload();
    const token = { payload, signature: "invalid", alg: "HMAC-SHA256" } as const;
    const result = await validateMandateToken(token, {
      expectedIntent: "analytics.track_event",
      minApprovals: 2,
      minRiskLevel: "high",
      secret,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("signature_invalid");
  });
});
