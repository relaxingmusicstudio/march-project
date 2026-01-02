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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "OPTIONS") {
    sendNoContent(res);
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
    sendJson(res, 200, {
      ok: false,
      status: 200,
      errorCode: "invalid_json",
      error: "invalid_json",
      code: "invalid_json",
    });
    return;
  }

  const payloadObject = body as Record<string, unknown>;
  const requestedFunction = typeof payloadObject.function === "string" ? payloadObject.function : null;
  const functionName = requestedFunction ?? "alex-chat";
  const payload =
    requestedFunction
      ? payloadObject.body ??
        payloadObject.payload ??
        (() => {
          const { function: _fn, ...rest } = payloadObject;
          return rest;
        })()
      : payloadObject;
  const isFunctionRequest = typeof requestedFunction === "string";

  if (requestedFunction && !ALLOWED_FUNCTIONS.has(functionName)) {
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

  const directMessage = typeof payloadObject.message === "string" ? payloadObject.message : "";
  if (!isFunctionRequest && !directMessage) {
    sendJson(res, 200, {
      ok: false,
      status: 200,
      errorCode: "missing_message",
      error: "missing_message",
      code: "missing_message",
    });
    return;
  }

  const { env, missing } = getEnvStatus();
  const supabaseUrl = stripEnvValue(env?.SUPABASE_URL);
  const serviceRoleKey = stripEnvValue(env?.SUPABASE_SERVICE_ROLE_KEY);

  if (isFunctionRequest && (missing.length > 0 || !supabaseUrl || !serviceRoleKey)) {
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

  const baseUrl = supabaseUrl ? normalizeSupabaseUrl(supabaseUrl) : "";
  const targetUrl = `${baseUrl}/functions/v1/${functionName}`;
  const shouldLogChat = functionName === "alex-chat";
  let chatMessageId: string | null = null;
  let writeOk = true;
  let writeError: string | null = null;

  if (shouldLogChat) {
    const { row } = buildChatInsert(payload as Record<string, unknown>, functionName);
    if (row) {
      if (!supabaseUrl || !serviceRoleKey) {
        writeOk = false;
        writeError = "missing_env";
      } else {
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
          writeOk = false;
          writeError = missingSchema ? "schema_missing" : "supabase_write_failed";
        } else {
          const parsed = parseJson(raw);
          chatMessageId = Array.isArray(parsed) ? parsed[0]?.id : (parsed as { id?: string } | null)?.id ?? null;
        }
      } catch (error) {
        const normalized = normalizeError(error);
        writeOk = false;
        writeError = normalized.errorMessage || "supabase_write_failed";
      }
      }
    }
  }

  if (!isFunctionRequest) {
    const visitorId =
      (typeof payloadObject.visitorId === "string" && payloadObject.visitorId) ||
      (typeof payloadObject.visitor_id === "string" && payloadObject.visitor_id) ||
      null;
    sendJson(res, 200, {
      ok: true,
      status: 200,
      reply: "Got it - I'm online. Tell me what you need and I'll route it.",
      id: chatMessageId,
      ts: Date.now(),
      write_ok: writeOk,
      write_error: writeError,
      data: { echo: directMessage, visitor_id: visitorId },
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

    sendJson(res, 200, {
      ok: true,
      status: 200,
      id: chatMessageId,
      ts: Date.now(),
      write_ok: writeOk,
      write_error: writeError,
      data,
    });
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
