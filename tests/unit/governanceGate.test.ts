import { describe, expect, it } from "vitest";
import { buildNoopPayload, getKernelLockState } from "../../src/kernel/governanceGate";

describe("governanceGate", () => {
  it("locks by default in production", () => {
    const state = getKernelLockState({ isProduction: true });
    expect(state.locked).toBe(true);
    expect(state.mode).toBe("locked");
  });

  it("opens by default outside production", () => {
    const state = getKernelLockState({ isProduction: false });
    expect(state.locked).toBe(false);
    expect(state.mode).toBe("open");
  });

  it("builds a noop payload when locked", () => {
    const state = getKernelLockState({ isProduction: true });
    const payload = buildNoopPayload(state, "test");
    expect(payload.ok).toBe(true);
    expect(payload.noop).toBe(true);
    expect(payload.reason_code).toBe("kernel_locked");
  });
});
