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
  res.end(JSON.stringify({ ok: true, ...data }));
};

export const jsonErr = (
  res: ApiResponse,
  status: number,
  errorCode: string,
  message: string,
  extra: Record<string, unknown> = {}
) => {
  res.statusCode = status;
  setJsonHeaders(res);
  res.end(JSON.stringify({ ok: false, status, errorCode, error: message, ...extra }));
};
