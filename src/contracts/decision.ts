export type DecisionStatus = "proposed" | "acted" | "confirmed" | "failed" | "unknown";

export type DecisionRationale = {
  reason_code: string;
  factors: string[];
};

export interface Decision {
  decision_id: string;
  query: string;
  recommendation: string;
  reasoning: string;
  rationale: DecisionRationale;
  assumptions: string[];
  confidence: number;
  uncertainty_score: number;
  uncertainty_notes: string[];
  next_action: string;
  fallback_path: string | null;
  status: DecisionStatus;
  created_at: string;
}

export const nowIso = (): string => new Date().toISOString();

export const clampConfidence = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
};
