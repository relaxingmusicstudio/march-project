export function detectGaps(results, topFailureModes) {
  const gaps = [];

  if (results.survival_rate < 0.85) {
    gaps.push({
      code: "low_survival",
      severity: "high",
      message: "Survival rate below 0.85 threshold.",
      evidence: { survival_rate: results.survival_rate },
    });
  }

  if (results.governance_drift_fail_rate > 0.1) {
    gaps.push({
      code: "governance_drift",
      severity: "high",
      message: "Governance drift failures exceed 0.10 threshold.",
      evidence: { governance_drift_fail_rate: results.governance_drift_fail_rate },
    });
  }

  if (results.liquidity_breaches_rate > 0.2) {
    gaps.push({
      code: "liquidity_breaches",
      severity: "high",
      message: "Liquidity breaches exceed 0.20 threshold.",
      evidence: { liquidity_breaches_rate: results.liquidity_breaches_rate },
    });
  }

  const dominant = topFailureModes.find((mode) => mode.pct > 0.35);
  if (dominant) {
    gaps.push({
      code: "dominant_failure_mode",
      severity: "high",
      message: "Single failure mode dominates above 0.35.",
      evidence: dominant,
    });
  }

  if (results.trust_collapse_rate > 0.25) {
    gaps.push({
      code: "trust_collapse",
      severity: "medium",
      message: "Trust collapse rate is elevated.",
      evidence: { trust_collapse_rate: results.trust_collapse_rate },
    });
  }

  return gaps;
}

export function evaluateFailClosed(results, topFailureModes) {
  const reasons = [];

  if (results.survival_rate < 0.85) {
    reasons.push("survival_rate_below_0.85");
  }
  if (results.governance_drift_fail_rate > 0.1) {
    reasons.push("governance_drift_fail_rate_above_0.10");
  }
  if (results.liquidity_breaches_rate > 0.2) {
    reasons.push("liquidity_breaches_rate_above_0.20");
  }
  if (topFailureModes.some((mode) => mode.pct > 0.35)) {
    reasons.push("dominant_failure_mode_above_0.35");
  }

  return { ok: reasons.length === 0, reasons };
}
