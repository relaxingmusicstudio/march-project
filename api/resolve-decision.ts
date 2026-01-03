import handler from "../api_handlers/resolve-decision.js";

export const config = { runtime: "nodejs" };

type ApiRequest = AsyncIterable<Uint8Array | string> & {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
  status: (code: number) => ApiResponse;
  json: (payload: Record<string, unknown>) => void;
};

const buildRequestId = () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default async function apiResolveDecision(req: ApiRequest, res: ApiResponse) {
  try {
    await handler(req, res);
  } catch (error) {
    const requestId = buildRequestId();
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : "Unhandled error";
    res.status(500).json({
      ok: false,
      error: { name, message },
      request_id: requestId,
    });
  }
}
