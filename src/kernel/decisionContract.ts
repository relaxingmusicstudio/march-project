export type DecisionStatus = "proposed" | "acted" | "confirmed" | "failed";

import type { CalibrationResult } from "../lib/metaCalibration.js";

export type DecisionRationale = {
  reason_code: string;
  factors: string[];
};

export type Decision = {
  decision_id: string;
  input_hash: string;
  recommendation: string;
  reasoning: string;
  rationale: DecisionRationale;
  assumptions: string[];
  confidence: number;
  uncertainty_score: number;
  calibration?: CalibrationResult;
  fallback_path: string | null;
  status: DecisionStatus;
  created_at: string;
};

export const clampConfidence = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};
