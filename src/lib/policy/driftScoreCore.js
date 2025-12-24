const clamp01 = (value) => Math.max(0, Math.min(1, value));

const normalized = (count, cap) => clamp01((Number.isFinite(count) ? count : 0) / cap);

export const computeDriftScore = (input) => {
  const invariantViolationsCount = Number(input?.invariantViolationsCount ?? 0);
  const prohibitedTargetHitsCount = Number(input?.prohibitedTargetHitsCount ?? 0);
  const missingIntentCount = Number(input?.missingIntentCount ?? 0);
  const missingApprovalCount = Number(input?.missingApprovalCount ?? 0);

  // Drift is a health score: 1 = healthy, 0 = severe drift.
  // Invariants + prohibited targets are treated as hard-signal penalties.
  const penalty =
    0.55 * normalized(invariantViolationsCount, 1) +
    0.30 * normalized(prohibitedTargetHitsCount, 1) +
    0.10 * normalized(missingIntentCount, 5) +
    0.05 * normalized(missingApprovalCount, 5);

  return clamp01(1 - clamp01(penalty));
};

