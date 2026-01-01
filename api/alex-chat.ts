export const config = { runtime: "nodejs" };

type ApiRequest = AsyncIterable<Uint8Array | string> & {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
type RequiredEnvKey = (typeof REQUIRED_ENV)[number];
const MAX_STACK = 2000;
const MAX_BODY_PREVIEW = 1200;

const ALLOWED_FUNCTIONS = new Set([
  "alex-chat",
  "contact-form",
  "user-input-logger",
  "analyze-lead",
  "agent-memory",
  "learn-from-success",
]);
const ALLOWED_CHAT_ROLES = new Set(["user", "assistant", "system"]);

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

const setCorsHeaders = (res: ApiResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
};

const sendJson = (res: ApiResponse, status: number, payload: Record<string, unknown>) => {
  res.statusCode = status;
  setCorsHeaders(res);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
};

const sendNoContent = (res: ApiResponse) => {
  res.statusCode = 200;
  setCorsHeaders(res);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ ok: true, status: 200 }));
};

const parseJson = (raw: string) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeSupabaseUrl = (url: string) => (url.endsWith("/") ? url.slice(0, -1) : url);

const stripEnvValue = (value: string | undefined) => value?.trim().replace(/^"|"$|^'|'$/g, "");

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    const stack = error.stack ?? "";
    const trimmedStack = stack.length > MAX_STACK ? `${stack.slice(0, MAX_STACK)}...` : stack;
    const cause =
      "cause" in error && error.cause !== undefined ? String((error as { cause?: unknown }).cause) : null;
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: trimmedStack,
      errorCause: cause,
    };
  }
  return {
    errorName: "unknown",
    errorMessage: String(error),
    errorStack: "",
    errorCause: null,
  };
};

const truncatePreview = (raw: string) =>
  raw.length > MAX_BODY_PREVIEW ? `${raw.slice(0, MAX_BODY_PREVIEW)}...` : raw;

const getEnvStatus = () => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const present = REQUIRED_ENV.reduce<Record<RequiredEnvKey, boolean>>((acc, key) => {
    acc[key] = Boolean(env?.[key]);
    return acc;
  }, {} as Record<RequiredEnvKey, boolean>);
  const missing = REQUIRED_ENV.filter((key) => !env?.[key]);
  return { env, present, missing };
};

const isMissingSchemaResponse = (status: number, raw: string, tableName: string) => {
  if (status !== 404 && status !== 400) return false;
  const parsed = parseJson(raw);
  if (parsed && typeof parsed === "object") {
    const code = typeof parsed.code === "string" ? parsed.code.toLowerCase() : "";
    const message = typeof parsed.message === "string" ? parsed.message.toLowerCase() : "";
    const hint = typeof parsed.hint === "string" ? parsed.hint.toLowerCase() : "";
    const details = typeof parsed.details === "string" ? parsed.details.toLowerCase() : "";
    const combined = `${code} ${message} ${hint} ${details}`;
    if (code === "pgrst205") return true;
    if (combined.includes("schema cache") || combined.includes("could not find the table")) return true;
    if (combined.includes(tableName.toLowerCase())) return true;
  }
  const lowered = raw.toLowerCase();
  if (lowered.includes("pgrst205")) return true;
  if (lowered.includes("schema cache") || lowered.includes("could not find the table")) return true;
  return lowered.includes(tableName.toLowerCase());
};

const buildChatInsert = (
  payload: Record<string, unknown>,
  functionName: string
): { row: Record<string, unknown> | null; messageCount: number } => {
  const visitorId =
    (typeof payload.visitorId === "string" && payload.visitorId) ||
    (typeof payload.visitor_id === "string" && payload.visitor_id) ||
    null;
  const messages = Array.isArray(payload.messages) ? payload.messages : null;
  const messageCount = Array.isArray(messages) ? messages.length : 0;
  const directMessage = typeof payload.message === "string" ? payload.message : "";

  if (directMessage) {
    return {
      row: {
        visitor_id: visitorId,
        role: "user",
        content: directMessage,
        meta: {
          function: functionName,
          message_count: messageCount,
          source: "direct",
        },
      },
      messageCount,
    };
  }

  if (!messages || messages.length === 0) {
    return { row: null, messageCount: 0 };
  }

  const last = messages[messages.length - 1] as Record<string, unknown>;
  const rawRole = typeof last.role === "string" ? last.role : "user";
  const role = ALLOWED_CHAT_ROLES.has(rawRole) ? rawRole : "user";
  const content = typeof last.content === "string" ? last.content : "";
  if (!content) {
    return { row: null, messageCount };
  }

  return {
    row: {
      visitor_id: visitorId,
      role,
      content,
      meta: {
        function: functionName,
        message_count: messageCount,
      },
    },
    messageCount,
  };
};

const buildHealthResponse = (method: string, envPresent: Record<RequiredEnvKey, boolean>) => ({
  status: "ok",
  method,
  expected_methods: ["POST"],
  required_env: [...REQUIRED_ENV],
  env_present: envPresent,
  message: "Use POST via Network tab or curl/Invoke-RestMethod for verification.",
});

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "OPTIONS") {
    sendNoContent(res);
    return;
  }

  const { env, present, missing } = getEnvStatus();

  if (req.method === "GET") {
    sendJson(res, 200, buildHealthResponse("GET", present));
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, {
      ok: false,
      status: 405,
      errorCode: "method_not_allowed",
      error: "method_not_allowed",
      code: "method_not_allowed",
    });
    return;
  }

  const body = await readJsonBody(req);
  if (!body || typeof body !== "object") {
    console.error("[api/alex-chat] Invalid JSON payload.");
    sendJson(res, 400, {
      ok: false,
      status: 400,
      errorCode: "bad_json",
      error: "bad_json",
      code: "bad_json",
    });
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
    sendJson(res, 403, {
      ok: false,
      status: 403,
      errorCode: "function_not_allowed",
      error: "function_not_allowed",
      code: "function_not_allowed",
    });
    return;
  }

  const supabaseUrl = stripEnvValue(env?.SUPABASE_URL);
  const serviceRoleKey = stripEnvValue(env?.SUPABASE_SERVICE_ROLE_KEY);

  if (missing.length > 0 || !supabaseUrl || !serviceRoleKey) {
    console.error("[api/alex-chat] Missing Supabase env.", {
      missing,
    });
    sendJson(res, 500, {
      ok: false,
      status: 500,
      errorCode: "server_env_missing",
      error: "server_env_missing",
      code: "server_env_missing",
      missing,
    });
    return;
  }

  const baseUrl = normalizeSupabaseUrl(supabaseUrl);
  const targetUrl = `${baseUrl}/functions/v1/${functionName}`;
  const isDirectPost = typeof payloadObject.function !== "string";
  const shouldLogChat = functionName === "alex-chat";
  let chatMessageId: string | null = null;

  if (shouldLogChat) {
    const { row } = buildChatInsert(payload as Record<string, unknown>, functionName);
    if (row) {
      const chatUrl = `${baseUrl}/rest/v1/chat_messages?select=id`;
      try {
        const chatResponse = await fetch(chatUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify(row),
        });
        const raw = await chatResponse.text();
        if (!chatResponse.ok) {
          const missingSchema = isMissingSchemaResponse(chatResponse.status, raw, "chat_messages");
          if (missingSchema) {
            sendJson(res, 500, {
              ok: false,
              status: 500,
              errorCode: "no_schema",
              error: "schema_missing",
              code: "no_schema",
              message: "Missing chat_messages table",
              details: truncatePreview(raw ?? ""),
            });
            return;
          }
          sendJson(res, 500, {
            ok: false,
            status: 500,
            errorCode: "supabase_error",
            error: "supabase_write_failed",
            code: "supabase_error",
            message: "Supabase insert failed",
            details: truncatePreview(raw ?? ""),
          });
          return;
        }
        const parsed = parseJson(raw);
        chatMessageId = Array.isArray(parsed) ? parsed[0]?.id : (parsed as { id?: string } | null)?.id ?? null;
      } catch (error) {
        const normalized = normalizeError(error);
        sendJson(res, 500, {
          ok: false,
          status: 500,
          errorCode: "supabase_error",
          error: "supabase_write_failed",
          code: "supabase_error",
          message: normalized.errorMessage,
          details: "chat_messages_insert_exception",
          ...normalized,
        });
        return;
      }
    }
  }

  if (isDirectPost) {
    sendJson(res, 200, {
      ok: true,
      status: 200,
      id: chatMessageId,
      ts: Date.now(),
      data: null,
    });
    return;
  }

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
        status: response.status,
        errorCode: "supabase_error",
        error: (data as { error?: string })?.error ?? "upstream_error",
        code: (data as { code?: string })?.code ?? "upstream_error",
        data,
      });
      return;
    }

    sendJson(res, 200, { ok: true, status: 200, id: chatMessageId, ts: Date.now(), data });
  } catch (error) {
    console.error("[api/alex-chat] Upstream exception.", {
      functionName,
      message: error instanceof Error ? error.message : "unknown",
    });
    const normalized = normalizeError(error);
    sendJson(res, 500, {
      ok: false,
      status: 500,
      errorCode: "supabase_error",
      error: error instanceof Error ? error.message : "upstream_exception",
      code: "upstream_exception",
      ...normalized,
    });
  }
}
