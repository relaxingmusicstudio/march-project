import { jsonErr, jsonOk, safeHandler, type ApiRequest, type ApiResponse } from "../src/kernel/apiJson.js";
import { ErrorCode } from "../src/kernel/errorCodes.js";

export const config = { runtime: "nodejs" };

const readJsonBody = async (req: ApiRequest) => {
  if (req?.body && typeof req.body === "object") {
    return req.body as Record<string, unknown>;
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
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const handler = async (req: ApiRequest, res: ApiResponse) => {
  const method = req.method?.toUpperCase() || "GET";
  if (method !== "POST") {
    jsonErr(res, 405, ErrorCode.METHOD_NOT_ALLOWED, "method_not_allowed");
    return;
  }

  const body = await readJsonBody(req);
  if (!body) {
    jsonErr(res, 400, ErrorCode.INVALID_JSON, "invalid_json");
    return;
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    jsonErr(res, 400, ErrorCode.MISSING_MESSAGE, "missing_message");
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    jsonOk(res, {
      reply: "AI not configured yet. Add OPENAI_API_KEY to enable real responses.",
      needsConfig: true,
      model: "mock",
    });
    return;
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: message }],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    jsonErr(res, response.status, ErrorCode.UPSTREAM_ERROR, "upstream_error");
    return;
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  const reply = (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message
    ?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    jsonErr(res, 502, ErrorCode.INVALID_JSON, "invalid_json");
    return;
  }

  jsonOk(res, {
    reply: reply.trim(),
    needsConfig: false,
    model,
  });
};

export default safeHandler(handler);
