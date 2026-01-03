import { MONTHS_PER_YEAR, clamp, pick } from "./types.js";

function makeArray(length, value) {
  return Array.from({ length }, () => value);
}

function applyWindow(start, duration, months, apply) {
  for (let i = 0; i < duration; i += 1) {
    const index = start + i;
    if (index >= months) break;
    apply(index);
  }
}

export function buildScenarioSchedule(rng, months, assumptions, toggles = {}) {
  const enabled = {
    inflation_shift: toggles.inflation_shift ?? true,
    recession: toggles.recession ?? true,
    fraud: toggles.fraud ?? true,
    governance: toggles.governance ?? true,
    rails: toggles.rails ?? true,
    catastrophe: toggles.catastrophe ?? true,
    regulatory: toggles.regulatory ?? true,
  };

  const inflation = makeArray(months, 0);
  const contribFactor = makeArray(months, 1);
  const payoutFactor = makeArray(months, 1);
  const adminFactor = makeArray(months, 1);
  const fraudRateAdd = makeArray(months, 0);
  const governanceDriftDelta = makeArray(months, 0);
  const trustDelta = makeArray(months, 0);
  const railsBlocked = makeArray(months, false);

  let catastropheOccurred = false;
  let regulatoryOccurred = false;

  const regimes = ["low", "med", "high"];
  let regime = pick(rng, regimes);
  for (let month = 0; month < months; month += 1) {
    if (enabled.inflation_shift && month % MONTHS_PER_YEAR === 0) {
      if (rng.random() < assumptions.scenario_probs.inflation_shift) {
        const next = pick(rng, regimes.filter((r) => r !== regime));
        regime = next ?? regime;
      }
    }
    const base = assumptions.inflation_regimes[regime] / MONTHS_PER_YEAR;
    const noisy = base + rng.normal(0, assumptions.inflation_monthly_sigma);
    inflation[month] = Math.max(0, noisy);
  }

  const years = Math.ceil(months / MONTHS_PER_YEAR);

  for (let year = 0; year < years; year += 1) {
    const yearStart = year * MONTHS_PER_YEAR;

    if (enabled.recession && rng.random() < assumptions.scenario_probs.recession) {
      const start = yearStart + rng.int(0, MONTHS_PER_YEAR - 1);
      const duration = rng.int(
        assumptions.scenario_durations.recession.min,
        assumptions.scenario_durations.recession.max,
      );
      applyWindow(start, duration, months, (index) => {
        const contrib = rng.random() * (
          assumptions.scenario_multipliers.recession_contrib_max -
            assumptions.scenario_multipliers.recession_contrib_min
        );
        const payout = rng.random() * (
          assumptions.scenario_multipliers.recession_payout_max -
            assumptions.scenario_multipliers.recession_payout_min
        );
        const admin = rng.random() * (
          assumptions.scenario_multipliers.admin_max -
            assumptions.scenario_multipliers.admin_min
        );
        contribFactor[index] *=
          assumptions.scenario_multipliers.recession_contrib_min + contrib;
        payoutFactor[index] *=
          assumptions.scenario_multipliers.recession_payout_min + payout;
        adminFactor[index] *= assumptions.scenario_multipliers.admin_min + admin;
        trustDelta[index] -= 0.003;
      });
    }

    if (enabled.fraud && rng.random() < assumptions.scenario_probs.fraud) {
      const start = yearStart + rng.int(0, MONTHS_PER_YEAR - 1);
      const duration = rng.int(
        assumptions.scenario_durations.fraud.min,
        assumptions.scenario_durations.fraud.max,
      );
      const multiplier = clamp(
        rng.normal(
          (assumptions.scenario_multipliers.fraud_multiplier_min +
            assumptions.scenario_multipliers.fraud_multiplier_max) /
            2,
          1.2,
        ),
        assumptions.scenario_multipliers.fraud_multiplier_min,
        assumptions.scenario_multipliers.fraud_multiplier_max,
      );
      applyWindow(start, duration, months, (index) => {
        fraudRateAdd[index] +=
          assumptions.fraud_rate_base * (multiplier - 1);
        trustDelta[index] -= 0.002;
      });
    }

    if (enabled.governance && rng.random() < assumptions.scenario_probs.governance) {
      const start = yearStart + rng.int(0, MONTHS_PER_YEAR - 1);
      const duration = rng.int(
        assumptions.scenario_durations.governance.min,
        assumptions.scenario_durations.governance.max,
      );
      applyWindow(start, duration, months, (index) => {
        governanceDriftDelta[index] += 0.006;
        payoutFactor[index] *= assumptions.scenario_multipliers.governance_payout_pressure;
        trustDelta[index] += assumptions.scenario_multipliers.governance_trust_delta;
      });
    }

    if (enabled.rails && rng.random() < assumptions.scenario_probs.rails) {
      const start = yearStart + rng.int(0, MONTHS_PER_YEAR - 1);
      const duration = rng.int(
        assumptions.scenario_durations.rails.min,
        assumptions.scenario_durations.rails.max,
      );
      applyWindow(start, duration, months, (index) => {
        railsBlocked[index] = true;
        contribFactor[index] *= assumptions.scenario_multipliers.rails_contrib_factor;
        trustDelta[index] -= 0.008;
      });
    }

    if (enabled.catastrophe && rng.random() < assumptions.scenario_probs.catastrophe) {
      const start = yearStart + rng.int(0, MONTHS_PER_YEAR - 1);
      const duration = rng.int(
        assumptions.scenario_durations.catastrophe.min,
        assumptions.scenario_durations.catastrophe.max,
      );
      catastropheOccurred = true;
      applyWindow(start, duration, months, (index) => {
        const multiplier = clamp(
          rng.normal(
            (assumptions.scenario_multipliers.catastrophe_payout_min +
              assumptions.scenario_multipliers.catastrophe_payout_max) /
              2,
            0.5,
          ),
          assumptions.scenario_multipliers.catastrophe_payout_min,
          assumptions.scenario_multipliers.catastrophe_payout_max,
        );
        payoutFactor[index] *= multiplier;
        trustDelta[index] -= 0.004;
      });
    }

    if (enabled.regulatory && rng.random() < assumptions.scenario_probs.regulatory) {
      const start = yearStart + rng.int(0, MONTHS_PER_YEAR - 1);
      const duration = rng.int(
        assumptions.scenario_durations.regulatory.min,
        assumptions.scenario_durations.regulatory.max,
      );
      regulatoryOccurred = true;
      applyWindow(start, duration, months, (index) => {
        const multiplier = clamp(
          rng.normal(
            (assumptions.scenario_multipliers.regulatory_admin_min +
              assumptions.scenario_multipliers.regulatory_admin_max) /
              2,
            0.1,
          ),
          assumptions.scenario_multipliers.regulatory_admin_min,
          assumptions.scenario_multipliers.regulatory_admin_max,
        );
        adminFactor[index] *= multiplier;
        trustDelta[index] -= 0.003;
        governanceDriftDelta[index] += 0.003;
      });
    }
  }

  return {
    inflation,
    contribFactor,
    payoutFactor,
    adminFactor,
    fraudRateAdd,
    governanceDriftDelta,
    trustDelta,
    railsBlocked,
    catastropheOccurred,
    regulatoryOccurred,
  };
}
