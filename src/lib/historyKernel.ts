import {
  HISTORY_DOMAIN,
  HISTORY_SOURCE_TYPE,
  HISTORY_ADDED_BY,
  createHistoryState as createHistoryStateCore,
  advanceHistoryClock as advanceHistoryClockCore,
  appendHistoryClaim as appendHistoryClaimCore,
  appendHistoryChallenge as appendHistoryChallengeCore,
  queryHistoryClaims as queryHistoryClaimsCore,
  evaluateHistoryUsage as evaluateHistoryUsageCore,
  getHistoryLedger as getHistoryLedgerCore,
} from "./historyKernelCore.js";

export type HistoryDomain = (typeof HISTORY_DOMAIN)[keyof typeof HISTORY_DOMAIN];
export const HistoryDomain = HISTORY_DOMAIN;

export type HistorySourceType = (typeof HISTORY_SOURCE_TYPE)[keyof typeof HISTORY_SOURCE_TYPE];
export const HistorySourceType = HISTORY_SOURCE_TYPE;

export type HistoryAddedBy = (typeof HISTORY_ADDED_BY)[keyof typeof HISTORY_ADDED_BY];
export const HistoryAddedBy = HISTORY_ADDED_BY;

export type HistorySource = {
  author: string;
  type: HistorySourceType;
  date: string;
};

export type HistoryClaim = {
  claim_id: string;
  claim_text: string;
  time_range: string;
  geography: string;
  domain: HistoryDomain;
  sources: ReadonlyArray<HistorySource>;
  counter_sources: ReadonlyArray<HistorySource>;
  evidence_grade: "A" | "B" | "C" | "D";
  confidence_score: number;
  controversy_score: number;
  added_by: HistoryAddedBy;
  added_at: string;
  falsifiable_prompt: string;
  challenge_of: string | null;
};

export type HistoryKernelState = {
  claims: HistoryClaim[];
  logicalClock: number;
};

export type HistoryClaimInput = {
  claim_id?: string;
  claim_text: string;
  time_range: string;
  geography: string;
  domain: HistoryDomain;
  sources: HistorySource[];
  counter_sources?: HistorySource[];
  evidence_grade: "A" | "B" | "C" | "D";
  confidence_score: number;
  controversy_score: number;
  added_by: HistoryAddedBy;
  writer_role?: HistoryAddedBy;
  added_at?: string;
  falsifiable_prompt: string;
  challenge_of?: string;
};

export type HistoryQueryRequest = {
  explicit_query: boolean;
  intent_id: string;
  domain?: HistoryDomain;
  geography?: string;
  time_range?: string;
};

export type HistoryQueryResult = {
  ok: boolean;
  reason: string;
  claims: ReadonlyArray<HistoryClaim>;
};

export type HistoryUsageInput = {
  explicit_intent: boolean;
  purpose: "context" | "justification";
  requested_by: "ceo_pilot" | "agent" | "system";
  overrides_constitution?: boolean;
  overrides_invariants?: boolean;
};

export type HistoryUsageResult = {
  ok: boolean;
  reason: string;
};

export const createHistoryState: (seed?: Partial<HistoryKernelState>) => HistoryKernelState = createHistoryStateCore;
export const advanceHistoryClock: (state: HistoryKernelState) => { state: HistoryKernelState; value: string } =
  advanceHistoryClockCore;
export const appendHistoryClaim: (
  state: HistoryKernelState,
  input: HistoryClaimInput
) => { state: HistoryKernelState; claim: HistoryClaim } = appendHistoryClaimCore;
export const appendHistoryChallenge: (
  state: HistoryKernelState,
  input: HistoryClaimInput & { challenge_of: string }
) => { state: HistoryKernelState; claim: HistoryClaim } = appendHistoryChallengeCore;
export const queryHistoryClaims: (state: HistoryKernelState, request: HistoryQueryRequest) => HistoryQueryResult = queryHistoryClaimsCore;
export const evaluateHistoryUsage: (input: HistoryUsageInput) => HistoryUsageResult = evaluateHistoryUsageCore;
export const getHistoryLedger: (claims: HistoryClaim[]) => HistoryClaim[] = getHistoryLedgerCore;
