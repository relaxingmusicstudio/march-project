import {
  clamp,
  clamp01,
  FAILURE_CODES,
  MONTHS_PER_YEAR,
} from "./types.js";
import { buildScenarioSchedule } from "./scenarios.js";

function totalWealth(state) {
  return state.operating_cash + state.stability_reserve + state.long_term_fund;
}

export function simulateRun(rng, config, assumptions) {
  const months = config.years * MONTHS_PER_YEAR;
  const scenario = buildScenarioSchedule(
    rng,
    months,
    assumptions,
    config.scenarios ?? {},
  );

  const state = {
    operating_cash: assumptions.base.operating_cash,
    stability_reserve: assumptions.base.stability_reserve,
    long_term_fund: assumptions.base.long_term_fund,
    trust_retention: assumptions.trust_retention_start,
    governance_drift: assumptions.governance_drift_start,
  };

  const rollingContrib = Array.from(
    { length: MONTHS_PER_YEAR },
    () => assumptions.base.contributions,
  );
  let rollingSum = assumptions.base.contributions * MONTHS_PER_YEAR;
  let rollingIndex = 0;

  let totalContrib = 0;
  let totalFraudLoss = 0;
  let maxDrawdown = 0;
  let peakWealth = totalWealth(state);

  let liquidityBreached = false;
  let governanceDriftFail = false;
  let trustCollapse = false;
  let insolvency = false;
  let railsShutdown = false;
  const failureModes = new Set();

  for (let month = 0; month < months; month += 1) {
    const inflation = scenario.inflation[month];

    let contributions = assumptions.base.contributions;
    contributions *= scenario.contribFactor[month];
    contributions *= 0.7 + 0.3 * state.trust_retention;
    contributions *= 1 + inflation * assumptions.contribution_inflation_pass;
    contributions = Math.max(0, contributions);

    if (scenario.railsBlocked[month]) {
      contributions *= assumptions.rail_shutdown_contrib_factor;
      railsShutdown = true;
    }

    let payouts = assumptions.base.payouts;
    payouts *= scenario.payoutFactor[month];
    payouts *= 1 + inflation * assumptions.payout_inflation_pass;
    payouts *= 1 + state.governance_drift * assumptions.governance_payout_pressure;

    let adminCosts = assumptions.base.admin_costs;
    adminCosts *= scenario.adminFactor[month];
    adminCosts *= 1 + inflation;
    adminCosts *= 1 + state.governance_drift * assumptions.governance_admin_drag;

    const avgContrib = rollingSum / MONTHS_PER_YEAR;
    const maxPayout = avgContrib * assumptions.phi_growth_cap;
    if (payouts > maxPayout) {
      payouts = maxPayout;
      state.trust_retention = clamp01(
        state.trust_retention - assumptions.trust_penalty_cap,
      );
    }

    const expectedOutflow = payouts + adminCosts;
    const minOperating = assumptions.min_operating_months * expectedOutflow;
    if (state.operating_cash < minOperating) {
      payouts *= 1 - assumptions.winter_reduction;
      adminCosts *= 1 - assumptions.winter_reduction;
      liquidityBreached = true;
      state.trust_retention = clamp01(
        state.trust_retention - assumptions.trust_penalty_winter,
      );
      failureModes.add(FAILURE_CODES.LIQUIDITY_BREACH);
    }

    const fraudRate = clamp(
      assumptions.fraud_rate_base + scenario.fraudRateAdd[month],
      0,
      assumptions.fraud_rate_cap,
    );
    const fraudLoss = contributions * fraudRate;
    totalFraudLoss += fraudLoss;

    state.operating_cash +=
      contributions - payouts - adminCosts - fraudLoss;

    if (state.operating_cash < 0) {
      const draw = Math.min(
        -state.operating_cash,
        state.stability_reserve * assumptions.reserve_draw_cap,
      );
      state.stability_reserve -= draw;
      state.operating_cash += draw;
    }

    if (state.operating_cash < 0) {
      const draw = Math.min(
        -state.operating_cash,
        state.long_term_fund * assumptions.long_term_draw_cap,
      );
      state.long_term_fund -= draw;
      state.operating_cash += draw;
    }

    const reserveReturn =
      (assumptions.reserve_return_mean +
        rng.normal(0, assumptions.reserve_return_vol)) /
      MONTHS_PER_YEAR;
    const longTermReturn =
      (assumptions.long_term_return_mean +
        rng.normal(0, assumptions.long_term_return_vol)) /
      MONTHS_PER_YEAR;
    state.stability_reserve *= 1 + reserveReturn;
    state.long_term_fund *= 1 + longTermReturn;

    const fraudPenalty =
      contributions > 0
        ? Math.min(
            assumptions.trust_penalty_fraud_scale,
            (fraudLoss / contributions) *
              assumptions.trust_penalty_fraud_scale,
          )
        : 0;

    const trustRecovery =
      state.operating_cash > minOperating
        ? assumptions.trust_recovery_base
        : 0;

    state.trust_retention = clamp01(
      state.trust_retention +
        scenario.trustDelta[month] +
        trustRecovery -
        assumptions.trust_decay_base -
        state.governance_drift * assumptions.trust_decay_per_drift -
        fraudPenalty,
    );

    if (scenario.railsBlocked[month]) {
      state.trust_retention = clamp01(
        state.trust_retention - assumptions.trust_penalty_rails,
      );
    }

    state.governance_drift = clamp01(
      state.governance_drift +
        assumptions.governance_drift_base +
        scenario.governanceDriftDelta[month] -
        assumptions.governance_drift_recovery * state.trust_retention,
    );

    if (
      state.governance_drift >= assumptions.governance_drift_fail_threshold
    ) {
      governanceDriftFail = true;
      failureModes.add(FAILURE_CODES.GOVERNANCE_DRIFT);
    }

    if (state.trust_retention <= assumptions.trust_collapse_threshold) {
      trustCollapse = true;
      failureModes.add(FAILURE_CODES.TRUST_COLLAPSE);
    }

    totalContrib += contributions;
    rollingSum += contributions - rollingContrib[rollingIndex];
    rollingContrib[rollingIndex] = contributions;
    rollingIndex = (rollingIndex + 1) % MONTHS_PER_YEAR;

    const total = totalWealth(state);
    if (total > peakWealth) peakWealth = total;
    const drawdown = peakWealth > 0 ? (peakWealth - total) / peakWealth : 1;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    if (!Number.isFinite(total) || total <= 0) {
      insolvency = true;
      failureModes.add(FAILURE_CODES.INSOLVENCY);
      break;
    }
  }

  if (railsShutdown && (liquidityBreached || trustCollapse || insolvency)) {
    failureModes.add(FAILURE_CODES.RAILS_SHUTDOWN);
  }
  if (
    scenario.catastropheOccurred &&
    (liquidityBreached || trustCollapse || insolvency)
  ) {
    failureModes.add(FAILURE_CODES.CATASTROPHIC_PAYOUT);
  }
  if (
    scenario.regulatoryOccurred &&
    (governanceDriftFail || trustCollapse || liquidityBreached || insolvency)
  ) {
    failureModes.add(FAILURE_CODES.REGULATORY_ATTACK);
  }

  const fraudLossRate = totalContrib > 0 ? totalFraudLoss / totalContrib : 0;
  if (fraudLossRate >= assumptions.fraud_loss_rate_threshold) {
    failureModes.add(FAILURE_CODES.FRAUD_LOSS);
  }

  return {
    finalWealth: totalWealth(state),
    maxDrawdown,
    liquidityBreached,
    governanceDriftFail,
    trustCollapse,
    fraudLossRate,
    survival: !insolvency,
    failureModes: Array.from(failureModes),
  };
}
