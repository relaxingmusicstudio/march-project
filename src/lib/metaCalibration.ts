export type CalibrationLabel = "high" | "medium" | "low" | "blocked";

export type CalibrationResult = {
  confidence: number;
  calibration_label: CalibrationLabel;
  block: boolean;
  block_reason: string | null;
  required_evidence: string[];
  missing_evidence: string[];
  notes_for_human: string;
};

export type CalibrationInput = {
  decision: Record<string, unknown>;
  context?: Record<string, unknown>;
  action?: string | null;
};

export const REVERSIBLE_ACTIONS = ["draft", "suggest", "plan", "ask_user", "analyze"] as const;

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

const normalizeConfidence = (decision: Record<string, unknown>) => {
  const rawConfidence = decision.confidence;
  if (typeof rawConfidence === "number" && Number.isFinite(rawConfidence)) {
    const normalized = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;
    return clampUnit(normalized);
  }
  const rawUncertainty = decision.uncertainty_score;
  if (typeof rawUncertainty === "number" && Number.isFinite(rawUncertainty)) {
    const normalized = rawUncertainty > 1 ? rawUncertainty / 100 : rawUncertainty;
    return clampUnit(1 - normalized);
  }
  return 0;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const hasOwn = (obj: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const calibrateDecision = (input: CalibrationInput): CalibrationResult => {
  const confidence = normalizeConfidence(input.decision);
  const context = input.context ?? {};
  const required_evidence: string[] = [];
  const missing_evidence: string[] = [];

  const requireEvidence = (key: string, ok: boolean) => {
    required_evidence.push(key);
    if (!ok) missing_evidence.push(key);
  };

  if (hasOwn(context, "context")) {
    requireEvidence("context", isNonEmptyString(context.context));
  }

  if (hasOwn(context, "evidence_summary")) {
    const summary = context.evidence_summary as Record<string, unknown> | null;
    const resultCount = summary?.resultCount;
    const domainCounts = summary?.domainCounts;
    const hasDomainEvidence =
      Array.isArray(domainCounts) &&
      domainCounts.some((entry) => {
        const count = (entry as { count?: unknown } | null)?.count;
        return typeof count === "number" && count > 0;
      });
    requireEvidence(
      "evidence_summary.resultCount",
      typeof resultCount === "number" && resultCount > 0
    );
    requireEvidence("evidence_summary.domainCounts", hasDomainEvidence);
  }

  if (hasOwn(context, "domains")) {
    requireEvidence("domains", Array.isArray(context.domains) && context.domains.length > 0);
  }

  if (hasOwn(context, "intent")) {
    requireEvidence("intent", Boolean(context.intent));
  }

  if (hasOwn(context, "sources")) {
    requireEvidence("sources", Array.isArray(context.sources) && context.sources.length > 0);
  }

  if (required_evidence.length === 0) {
    requireEvidence("context", false);
  }

  const block = missing_evidence.length > 0;
  const block_reason = block ? "missing_evidence" : null;

  let calibration_label: CalibrationLabel = "high";
  if (block) {
    calibration_label = "blocked";
  } else if (confidence < 0.55) {
    calibration_label = "low";
  } else if (confidence < 0.75) {
    calibration_label = "medium";
  }

  let notes_for_human = "Confidence high; actions permitted.";
  if (block) {
    notes_for_human = `Missing evidence: ${missing_evidence.join(", ") || "unknown"}.`;
  } else if (confidence < 0.55) {
    notes_for_human = "Confidence below 0.55; defaulting to noop.";
  } else if (confidence < 0.75) {
    notes_for_human = "Confidence medium; reversible actions only.";
  }

  return {
    confidence,
    calibration_label,
    block,
    block_reason,
    required_evidence,
    missing_evidence,
    notes_for_human,
  };
};

export const getCalibrationGate = (calibration: CalibrationResult, action?: string | null) => {
  const isReversible =
    typeof action === "string" &&
    REVERSIBLE_ACTIONS.includes(action as (typeof REVERSIBLE_ACTIONS)[number]);
  if (calibration.block || calibration.calibration_label === "blocked") {
    return { noop: true, reason_code: "calibration_blocked" };
  }
  if (calibration.confidence < 0.55) {
    return { noop: true, reason_code: "low_confidence" };
  }
  if (calibration.confidence < 0.75 && action && !isReversible) {
    return { noop: true, reason_code: "confidence_gate" };
  }
  return { noop: false, reason_code: null };
};
