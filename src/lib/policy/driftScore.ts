import { computeDriftScore as computeDriftScoreCore } from "./driftScoreCore.js";

export type DriftScoreInput = {
  invariantViolationsCount: number;
  prohibitedTargetHitsCount: number;
  missingIntentCount: number;
  missingApprovalCount: number;
};

export const computeDriftScore: (input: DriftScoreInput) => number = computeDriftScoreCore;

