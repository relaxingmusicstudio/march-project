export const MONTHS_PER_YEAR = 12;
export const PHI = 1.618;

export const FAILURE_CODES = {
  INSOLVENCY: "insolvency",
  LIQUIDITY_BREACH: "liquidity_breach",
  GOVERNANCE_DRIFT: "governance_drift",
  TRUST_COLLAPSE: "trust_collapse",
  FRAUD_LOSS: "fraud_loss",
  RAILS_SHUTDOWN: "rails_shutdown",
  CATASTROPHIC_PAYOUT: "catastrophic_payout",
  REGULATORY_ATTACK: "regulatory_attack",
};

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value) {
  return clamp(value, 0, 1);
}

export function toMonthlyRate(annualRate) {
  return annualRate / MONTHS_PER_YEAR;
}

export function createRng(seed) {
  let state = seed >>> 0;
  let spare = null;

  function random() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function normal(mean = 0, stdDev = 1) {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return mean + stdDev * value;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = random();
    while (v === 0) v = random();
    const mag = Math.sqrt(-2 * Math.log(u));
    const z0 = mag * Math.cos(2 * Math.PI * v);
    const z1 = mag * Math.sin(2 * Math.PI * v);
    spare = z1;
    return mean + stdDev * z0;
  }

  function logNormal(mean = 0, stdDev = 1) {
    return Math.exp(normal(mean, stdDev));
  }

  function int(min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  return { random, normal, logNormal, int };
}

export function pick(rng, items) {
  return items[Math.floor(rng.random() * items.length)];
}

export const DEFAULT_ASSUMPTIONS = {
  units: "monthly_currency",
  base: {
    operating_cash: 4000000,
    stability_reserve: 7000000,
    long_term_fund: 18000000,
    contributions: 450000,
    payouts: 250000,
    admin_costs: 70000,
  },
  inflation_regimes: {
    low: 0.02,
    med: 0.04,
    high: 0.08,
  },
  inflation_monthly_sigma: 0.002,
  contribution_inflation_pass: 0.4,
  payout_inflation_pass: 1.0,
  reserve_return_mean: 0.02,
  reserve_return_vol: 0.04,
  long_term_return_mean: 0.06,
  long_term_return_vol: 0.12,
  trust_retention_start: 0.92,
  governance_drift_start: 0.08,
  governance_drift_base: 0.0005,
  governance_drift_recovery: 0.002,
  governance_payout_pressure: 0.1,
  governance_admin_drag: 0.12,
  trust_decay_base: 0.0008,
  trust_decay_per_drift: 0.006,
  trust_recovery_base: 0.0015,
  trust_penalty_winter: 0.006,
  trust_penalty_rails: 0.01,
  trust_penalty_cap: 0.005,
  trust_penalty_fraud_scale: 0.03,
  trust_collapse_threshold: 0.35,
  governance_drift_fail_threshold: 0.75,
  fraud_rate_base: 0.0015,
  fraud_rate_cap: 0.03,
  fraud_loss_rate_threshold: 0.025,
  rail_shutdown_contrib_factor: 0.2,
  phi_growth_cap: PHI,
  min_operating_months: 3,
  winter_reduction: 0.15,
  reserve_draw_cap: 0.12,
  long_term_draw_cap: 0.003,
  scenario_probs: {
    inflation_shift: 0.12,
    recession: 0.12,
    fraud: 0.08,
    governance: 0.06,
    rails: 0.03,
    catastrophe: 0.015,
    regulatory: 0.02,
  },
  scenario_durations: {
    recession: { min: 6, max: 18 },
    fraud: { min: 3, max: 9 },
    governance: { min: 6, max: 24 },
    rails: { min: 1, max: 4 },
    catastrophe: { min: 1, max: 2 },
    regulatory: { min: 3, max: 12 },
  },
  scenario_multipliers: {
    recession_contrib_min: 0.7,
    recession_contrib_max: 0.85,
    recession_payout_min: 1.05,
    recession_payout_max: 1.25,
    admin_min: 1.02,
    admin_max: 1.1,
    fraud_multiplier_min: 2,
    fraud_multiplier_max: 5,
    governance_payout_pressure: 1.05,
    governance_trust_delta: -0.005,
    rails_contrib_factor: 0.15,
    catastrophe_payout_min: 1.6,
    catastrophe_payout_max: 2.8,
    regulatory_admin_min: 1.1,
    regulatory_admin_max: 1.25,
  },
};
