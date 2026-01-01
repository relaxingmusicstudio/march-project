export const config = { runtime: "nodejs" };

type ApiRequest = {
  method?: string;
};

type ApiResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const sendJson = (res: ApiResponse, status: number, payload: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
};

export default function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "method_not_allowed", code: "method_not_allowed" });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    node: process.version,
    ts: Date.now(),
  });
}
