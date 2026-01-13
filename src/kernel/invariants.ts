import { ErrorCode } from "./errorCodes.js";

export type DecisionGuardrailError = {
  field: string;
  code: string;
  message: string;
};

type InvariantCheck = {
  ok: boolean;
  errorCode?: ErrorCode;
  errors: DecisionGuardrailError[];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const resolveDecisionInvariantErrorCode = (errors: DecisionGuardrailError[]): ErrorCode => {
  const codes = new Set(errors.map((error) => error.code));
  if (codes.has("missing_handle")) return ErrorCode.MISSING_HANDLE;
  if (codes.has("missing_claim")) return ErrorCode.MISSING_CLAIM;
  if (codes.has("missing_goal")) return ErrorCode.MISSING_GOAL;
  if (codes.has("missing_decision_ref")) return ErrorCode.MISSING_DECISION_REF;
  return ErrorCode.INVALID_DECISION_INPUT;
};

export const checkDecisionBindings = (payload: Record<string, unknown>): InvariantCheck => {
  const errors: DecisionGuardrailError[] = [];
  const handle = payload.handle;
  const claim = payload.claim;
  const provenance = payload.provenance;
  const goal = payload.goal_id ?? payload.goal_ref;
  const decision = payload.decision_id ?? payload.decision_ref ?? payload.id;

  if (!isPlainObject(handle)) {
    errors.push({
      field: "handle",
      code: "missing_handle",
      message: "handle is required",
    });
  }
  if (!isPlainObject(claim)) {
    errors.push({
      field: "claim",
      code: "missing_claim",
      message: "claim is required",
    });
  }
  if (!isPlainObject(provenance)) {
    errors.push({
      field: "provenance",
      code: "missing_provenance",
      message: "provenance is required",
    });
  }
  if (typeof goal !== "string" || !goal.trim()) {
    errors.push({
      field: "goal_id",
      code: "missing_goal",
      message: "goal_id or goal_ref is required",
    });
  }
  if (typeof decision !== "string" || !decision.trim()) {
    errors.push({
      field: "decision_id",
      code: "missing_decision_ref",
      message: "decision_id or decision_ref is required",
    });
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errorCode: resolveDecisionInvariantErrorCode(errors),
      errors,
    };
  }

  return { ok: true, errors };
};
