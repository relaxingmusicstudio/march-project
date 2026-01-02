export type KernelLockMode = "locked" | "open";

export type KernelLockState = {
  locked: boolean;
  mode: KernelLockMode;
  reason: string;
};

export const getKernelLockState = (options: {
  isProduction: boolean;
  override?: KernelLockMode;
}): KernelLockState => {
  const mode = options.override ?? (options.isProduction ? "locked" : "open");
  const locked = mode === "locked";
  const reason = options.override
    ? `override_${mode}`
    : locked
      ? "default_locked"
      : "default_open";
  return { locked, mode, reason };
};

export const buildNoopPayload = (state: KernelLockState, detail?: string) => ({
  ok: true,
  status: 200,
  noop: true,
  reason_code: "kernel_locked",
  lock: {
    locked: state.locked,
    mode: state.mode,
    reason: state.reason,
  },
  detail,
});
