export type DecisionOutcomeType =
  | "executed"
  | "deferred"
  | "declined"
  | "transformed"
  | "expired"
  | "halted";

export type DecisionOutcome = {
  type: DecisionOutcomeType;
  summary: string;
  details?: Record<string, unknown>;
  nextAction?: {
    kind: "ASK_USER" | "REQUEST_APPROVAL" | "RUN_NEXT" | "SCHEDULE";
    payload?: unknown;
  };
};

type OutcomeDetails = Record<string, unknown> | undefined;
type OutcomeNextAction = DecisionOutcome["nextAction"];

const buildOutcome = (
  type: DecisionOutcomeType,
  summary: string,
  details?: OutcomeDetails,
  nextAction?: OutcomeNextAction
): DecisionOutcome => {
  const trimmedSummary = summary.trim();
  const outcome: DecisionOutcome = {
    type,
    summary: trimmedSummary.length > 0 ? trimmedSummary : type,
  };
  if (details && Object.keys(details).length > 0) {
    outcome.details = details;
  }
  if (nextAction) {
    outcome.nextAction = nextAction;
  }
  return outcome;
};

export const executed = (summary: string, details?: OutcomeDetails, nextAction?: OutcomeNextAction): DecisionOutcome =>
  buildOutcome("executed", summary, details, nextAction);

export const deferred = (summary: string, details?: OutcomeDetails, nextAction?: OutcomeNextAction): DecisionOutcome =>
  buildOutcome("deferred", summary, details, nextAction);

export const declined = (summary: string, details?: OutcomeDetails, nextAction?: OutcomeNextAction): DecisionOutcome =>
  buildOutcome("declined", summary, details, nextAction);

export const transformed = (summary: string, details?: OutcomeDetails, nextAction?: OutcomeNextAction): DecisionOutcome =>
  buildOutcome("transformed", summary, details, nextAction);

export const expired = (summary: string, details?: OutcomeDetails, nextAction?: OutcomeNextAction): DecisionOutcome =>
  buildOutcome("expired", summary, details, nextAction);

export const halted = (summary: string, details?: OutcomeDetails, nextAction?: OutcomeNextAction): DecisionOutcome =>
  buildOutcome("halted", summary, details, nextAction);

export const assertNever = (value: never): never => {
  throw new Error(`Unhandled DecisionOutcome type: ${JSON.stringify(value)}`);
};

export const summarizeOutcome = (outcome: DecisionOutcome): string => {
  switch (outcome.type) {
    case "executed":
      return outcome.summary;
    case "deferred":
      return outcome.summary;
    case "declined":
      return outcome.summary;
    case "transformed":
      return outcome.summary;
    case "expired":
      return outcome.summary;
    case "halted":
      return outcome.summary;
    default:
      return assertNever(outcome);
  }
};
