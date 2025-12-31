type ApiRequest = AsyncIterable<Uint8Array | string> & {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const ALLOWED_FUNCTIONS = new Set([
  "alex-chat",
  "contact-form",
  "user-input-logger",
  "analyze-lead",
  "agent-memory",
  "learn-from-success",
]);

const readJsonBody = async (req: ApiRequest) => {
  if (req?.body && typeof req.body === "object") {
    return req.body;
  }
  let raw = "";
  for await (const chunk of req) {
    if (typeof chunk === "string") {
      raw += chunk;
      continue;
    }
    raw += new TextDecoder().decode(chunk);
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const sendJson = (res: ApiResponse, status: number, payload: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.end(JSON.stringify(payload));
};

const parseJson = (raw: string) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method_not_allowed", code: "method_not_allowed" });
    return;
  }

  const body = await readJsonBody(req);
  if (!body || typeof body !== "object") {
    console.error("[api/alex-chat] Invalid JSON payload.");
    sendJson(res, 400, { ok: false, error: "invalid_json", code: "invalid_json" });
    return;
  }

  const payloadObject = body as Record<string, unknown>;
  const functionName =
    typeof payloadObject.function === "string" ? payloadObject.function : "alex-chat";
  const payload =
    payloadObject.body ??
    payloadObject.payload ??
    (typeof payloadObject.function === "string"
      ? (() => {
          const { function: _fn, ...rest } = payloadObject;
          return rest;
        })()
      : payloadObject);

  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    console.error("[api/alex-chat] Function not allowed:", functionName);
    sendJson(res, 403, { ok: false, error: "function_not_allowed", code: "function_not_allowed" });
    return;
  }

  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const supabaseUrl = env?.SUPABASE_URL;
  const serviceRoleKey = env?.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[api/alex-chat] Missing Supabase env.", {
      hasUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
    });
    sendJson(res, 500, { ok: false, error: "server_env_missing", code: "server_env_missing" });
    return;
  }

  const targetUrl = `${supabaseUrl}/functions/v1/${functionName}`;

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(payload ?? {}),
    });

    const raw = await response.text();
    const data = parseJson(raw) ?? (raw ? { raw } : null);

    if (!response.ok) {
      console.error("[api/alex-chat] Upstream error.", {
        functionName,
        status: response.status,
      });
      sendJson(res, response.status, {
        ok: false,
        error: (data as { error?: string })?.error ?? "upstream_error",
        code: (data as { code?: string })?.code ?? "upstream_error",
        data,
      });
      return;
    }

    sendJson(res, 200, { ok: true, data });
  } catch (error) {
    console.error("[api/alex-chat] Upstream exception.", {
      functionName,
      message: error instanceof Error ? error.message : "unknown",
    });
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "upstream_exception",
      code: "upstream_exception",
    });
  }
}
