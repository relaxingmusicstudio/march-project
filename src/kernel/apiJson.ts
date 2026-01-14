import { fail, ok } from "./envelope.js";
import { ErrorCode } from "./errorCodes.js";

export type ApiResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

export type ApiRequest = AsyncIterable<Uint8Array | string> & {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
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

export const safeHandler =
  (handler: (req: ApiRequest, res: ApiResponse) => Promise<void> | void) =>
  async (req: ApiRequest, res: ApiResponse) => {
    try {
      await handler(req, res);
    } catch {
      jsonErr(res, 500, ErrorCode.HANDLER_FAILED, "handler_failed");
    }
  };
