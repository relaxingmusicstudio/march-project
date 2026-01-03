function quantile(sortedValues, q) {
  if (sortedValues.length === 0) return 0;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedValues[base + 1] !== undefined) {
    return (
      sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base])
    );
  }
  return sortedValues[base];
}

function median(sortedValues) {
  return quantile(sortedValues, 0.5);
}

export function summarizeRuns(runs, options = {}) {
  const totalRuns = runs.length;
  const finalWealths = runs
    .map((run) => run.finalWealth)
    .sort((a, b) => a - b);
  const maxDrawdowns = runs
    .map((run) => run.maxDrawdown)
    .sort((a, b) => a - b);

  const failureCounts = new Map();
  for (const run of runs) {
    for (const code of run.failureModes) {
      failureCounts.set(code, (failureCounts.get(code) ?? 0) + 1);
    }
  }

  const top_failure_modes = Array.from(failureCounts.entries())
    .map(([code, count]) => ({
      code,
      count,
      pct: totalRuns > 0 ? count / totalRuns : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const survival_rate =
    runs.filter((run) => run.survival).length / totalRuns;
  const liquidity_breaches_rate =
    runs.filter((run) => run.liquidityBreached).length / totalRuns;
  const governance_drift_fail_rate =
    runs.filter((run) => run.governanceDriftFail).length / totalRuns;
  const fraudLossThreshold = options.fraudLossThreshold ?? 0.03;
  const fraud_loss_rate =
    runs.filter((run) => run.fraudLossRate >= fraudLossThreshold).length /
    totalRuns;
  const trust_collapse_rate =
    runs.filter((run) => run.trustCollapse).length / totalRuns;

  const results = {
    survival_rate,
    median_final_wealth: median(finalWealths),
    p10_final_wealth: quantile(finalWealths, 0.1),
    p90_final_wealth: quantile(finalWealths, 0.9),
    median_max_drawdown: median(maxDrawdowns),
    liquidity_breaches_rate,
    governance_drift_fail_rate,
    fraud_loss_rate,
    trust_collapse_rate,
  };

  return { results, top_failure_modes };
}
