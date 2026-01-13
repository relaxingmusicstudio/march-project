import { fail, ok } from "./envelope.js";
import type { ErrorCode } from "./errorCodes.js";

export type ApiResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const setJsonHeaders = (res: ApiResponse) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
};

export const jsonOk = (res: ApiResponse, data: Record<string, unknown> = {}) => {
  res.statusCode = 200;
  setJsonHeaders(res);
  res.end(JSON.stringify(ok(data)));
};

export const jsonErr = (
  res: ApiResponse,
  status: number,
  errorCode: ErrorCode | string,
  message: string,
  extra: Record<string, unknown> = {}
) => {
  res.statusCode = status;
  setJsonHeaders(res);
  res.end(JSON.stringify(fail(status, errorCode, message, extra)));
};
