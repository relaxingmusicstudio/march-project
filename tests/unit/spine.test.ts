import { describe, expect, it } from "vitest";
import { executed } from "../../src/lib/decisionOutcome";
import {
  appendLedger,
  computeIdentityKey,
  getTrustLevel,
  policyPreflight,
  type ActionSpec,
  type Intent,
} from "../../src/lib/spine";

const baseIntent: Intent = {
  intent_id: "intent-001",
  intent_type: "ops",
  intent_reason: "Execute deterministic task",
  expected_metric: "checklist_progress",
};

const baseAction: ActionSpec = {
  action_type: "do_next",
  params: { taskId: "task-1" },
  irreversible_level: 0,
  requires_confirmation: false,
  cooldown_ms: 0,
};

const makeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

describe("spine policy + ledger", () => {
  it("blocks when intent is missing in real mode", () => {
    const brokenIntent = { ...baseIntent, intent_id: "" } as Intent;
    const result = policyPreflight(brokenIntent, baseAction, 4, {
      isMockMode: false,
      missingRequired: [],
    });
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons.some((reason) => reason.startsWith("intent_missing"))).toBe(true);
  });

  it("blocks irreversible action at low trust", () => {
    const action: ActionSpec = { ...baseAction, irreversible_level: 3 };
    const result = policyPreflight(baseIntent, action, 1, {
      isMockMode: false,
      missingRequired: [],
    });
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons).toContain("insufficient_trust");
  });

  it("returns friction steps for irreversible actions", () => {
    const action: ActionSpec = {
      ...baseAction,
      irreversible_level: 1,
      requires_confirmation: true,
      cooldown_ms: 120000,
    };
    const result = policyPreflight(baseIntent, action, 4, {
      isMockMode: false,
      missingRequired: [],
    });
    expect(result.decision).toBe("ALLOW_WITH_FRICTION");
    expect(result.frictionSteps).toContain("confirm_token");
    expect(result.frictionSteps).toContain("cooldown_ms:120000");
  });

  it("appends ledger entries without mutating previous entries", () => {
    const storage = makeStorage();
    const identity = computeIdentityKey("user-1", "");
    const trust = getTrustLevel(identity, { storage });
    const preflight = policyPreflight(baseIntent, baseAction, trust, {
      isMockMode: false,
      missingRequired: [],
    });
    const entry = {
      timestamp: "",
      identity,
      intent: baseIntent,
      actionSpec: baseAction,
      preflight,
      outcome: executed("ok"),
      evidenceRefs: ["unit-test"],
    };

    const firstLedger = appendLedger(entry, { storage });
    const secondLedger = appendLedger(entry, { storage });

    expect(firstLedger).toHaveLength(1);
    expect(secondLedger).toHaveLength(2);
    expect(firstLedger[0].intent.intent_id).toBe("intent-001");
    expect(secondLedger[0]).toEqual(firstLedger[0]);
  });
});
