export const config = { runtime: "nodejs" };

type ApiRequest = AsyncIterable<Uint8Array | string> & {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const getSha = () =>
  process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null;

const sendJson = (res: ApiResponse, status: number, payload: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
};

export default async function healthHandler(req: ApiRequest, res: ApiResponse) {
  const method = req.method?.toUpperCase() || "GET";
  if (method !== "GET" && method !== "HEAD") {
    sendJson(res, 405, { status: "error", message: "method_not_allowed" });
    return;
  }

  sendJson(res, 200, { status: "ok", sha: getSha() });
}
