import { describe, expect, it } from "vitest";
import {
  executed,
  halted,
  summarizeOutcome,
  type DecisionOutcome,
  assertNever,
} from "../../src/lib/decisionOutcome";
import { ensureOutcome, requireFields } from "../../src/lib/loopGuard";

const renderOutcome = (outcome: DecisionOutcome): string => {
  switch (outcome.type) {
    case "executed":
      return outcome.summary;
    case "halted":
      return outcome.summary;
    case "deferred":
      return outcome.summary;
    case "transformed":
      return outcome.summary;
    case "expired":
      return outcome.summary;
    case "declined":
      return outcome.summary;
    default:
      return assertNever(outcome);
  }
};

describe("decisionOutcome helpers", () => {
  it("passes through valid outcomes", () => {
    const outcome = executed("Complete the action");
    expect(ensureOutcome(outcome, "fallback")).toEqual(outcome);
    expect(summarizeOutcome(outcome)).toBe("Complete the action");
  });

  it("converts invalid outcomes to halted with details", () => {
    const outcome = ensureOutcome({ type: "unknown" }, "fallback");
    expect(outcome.type).toBe("halted");
    expect(outcome.summary).toBe("fallback");
    expect(outcome.details?.receivedType).toBe("object");
    expect(Array.isArray(outcome.details?.receivedKeys)).toBe(true);
  });

  it("normalizes legacy outcomes", () => {
    const outcome = ensureOutcome({ type: "DONE", summary: "Legacy success" }, "fallback");
    expect(outcome.type).toBe("executed");
    expect(outcome.summary).toBe("Legacy success");
  });

  it("blocks when required fields are missing", () => {
    const result = requireFields({ foo: "bar" }, ["foo", "missing"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.outcome.type).toBe("halted");
      expect(result.outcome.summary).toBe("MISSING_FIELDS");
      expect(result.outcome.details?.missing).toEqual(["missing"]);
    }
  });

  it("demonstrates exhaustive switch handling", () => {
    const outcome = halted("Waiting on approval");
    expect(renderOutcome(outcome)).toBe("Waiting on approval");
  });
});
