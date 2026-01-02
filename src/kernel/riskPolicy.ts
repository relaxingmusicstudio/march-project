import type { KernelConstraints, KernelIntent } from "@/kernel/run";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type RiskAssessment = {
  score: number;
  level: RiskLevel;
  reason: string;
  budgetCents: number;
};

export type RiskGateResult = {
  action: "allow" | "noop";
  reasonCode: string;
  assessment: RiskAssessment;
};

const clampScore = (value: number) => Math.max(0, Math.min(1, value));

const levelForScore = (score: number): RiskLevel => {
  if (score >= 0.85) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.3) return "medium";
  return "low";
};

const defaultBudgetForLevel = (level: RiskLevel): number => {
  switch (level) {
    case "critical":
      return 0;
    case "high":
      return 500;
    case "medium":
      return 200;
    default:
      return 50;
  }
};

export const scoreIntentRisk = (intent: KernelIntent, context: Record<string, unknown>): RiskAssessment => {
  let base = 0.15;
  let reason = "default";

  if (intent.startsWith("analytics.")) {
    base = 0.2;
    reason = "analytics";
  } else if (intent.startsWith("memory.")) {
    base = 0.35;
    reason = "memory";
  } else if (intent === "kernel.health") {
    base = 0.05;
    reason = "health";
  }

  if (typeof context.sensitivity === "number") {
    base += context.sensitivity * 0.4;
    reason = "context_sensitivity";
  }

  const score = clampScore(base);
  const level = levelForScore(score);
  const budgetCents = defaultBudgetForLevel(level);

  return {
    score,
    level,
    reason,
    budgetCents,
  };
};

export const evaluateRiskGate = (
  intent: KernelIntent,
  context: Record<string, unknown>,
  constraints: KernelConstraints
): RiskGateResult => {
  const assessment = scoreIntentRisk(intent, context);
  const tolerance = typeof constraints.riskTolerance === "number" ? constraints.riskTolerance : 0.6;
  const allowHighRisk = constraints.allowHighRisk === true;

  if (assessment.score > tolerance && !allowHighRisk) {
    return {
      action: "noop",
      reasonCode: "risk_threshold_exceeded",
      assessment,
    };
  }

  return {
    action: "allow",
    reasonCode: "risk_ok",
    assessment,
  };
};

export const evaluateAssumptions = (constraints: KernelConstraints) => {
  const assumptions = constraints.assumptions;
  if (!assumptions || assumptions.length === 0) {
    return { ok: true, reasonCode: "no_assumptions" };
  }

  const now = Date.now();
  for (const assumption of assumptions) {
    const expiresAt = assumption.expiresAt ? Date.parse(assumption.expiresAt) : null;
    if (expiresAt && Number.isFinite(expiresAt) && expiresAt <= now) {
      return { ok: false, reasonCode: "assumption_expired", detail: assumption.key };
    }
    if (!assumption.validatedAt) {
      return { ok: false, reasonCode: "assumption_unvalidated", detail: assumption.key };
    }
  }

  return { ok: true, reasonCode: "assumptions_ok" };
};
