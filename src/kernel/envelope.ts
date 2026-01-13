import type { ErrorCode } from "./errorCodes.js";

export type OkEnvelope<T extends Record<string, unknown> = Record<string, unknown>> = {
  ok: true;
} & T & {
  meta?: Record<string, unknown>;
};

export type ErrorEnvelope = {
  ok: false;
  status: number;
  errorCode: ErrorCode | string;
  error: string;
  meta?: Record<string, unknown>;
} & Record<string, unknown>;

export const ok = <T extends Record<string, unknown>>(data: T = {} as T, meta?: Record<string, unknown>) => {
  const payload: OkEnvelope<T> = { ok: true, ...data };
  if (meta) {
    payload.meta = meta;
  }
  return payload;
};

export const fail = (
  status: number,
  errorCode: ErrorCode | string,
  error: string,
  extra: Record<string, unknown> = {},
  meta?: Record<string, unknown>,
) => {
  const payload: ErrorEnvelope = { ok: false, status, errorCode, error, ...extra };
  if (meta) {
    payload.meta = meta;
  }
  return payload;
};
