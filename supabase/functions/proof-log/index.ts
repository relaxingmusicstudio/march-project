import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const baseCorsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

type CorsConfig = {
  origins: string[];
  regexes: RegExp[];
  allowedList: string[];
};

const parseCorsConfig = (): CorsConfig => {
  const origins: string[] = [];
  const singleOrigin = Deno.env.get("CORS_ORIGIN") ?? Deno.env.get("APP_ORIGIN");
  if (singleOrigin) origins.push(singleOrigin);
  const originList = Deno.env.get("CORS_ORIGINS");
  if (originList) {
    originList.split(",").forEach((item) => origins.push(item));
  }

  const regexes: RegExp[] = [];
  const rawRegex = Deno.env.get("CORS_ORIGIN_REGEX");
  if (rawRegex) {
    rawRegex
      .split(",")
      .map((pattern) => pattern.trim())
      .filter(Boolean)
      .forEach((pattern) => {
        try {
          regexes.push(new RegExp(pattern));
        } catch {
          // ignore invalid regex
        }
      });
  }

  const normalizedOrigins = origins.map((origin) => origin.trim()).filter(Boolean);
  const allowedList = Array.from(
    new Set([
      ...normalizedOrigins,
      ...regexes.map((regex) => `regex:${regex.source}`),
    ])
  );
  return { origins: normalizedOrigins, regexes, allowedList };
};

const hostMatches = (patternHost: string, originHost: string) => {
  if (patternHost.startsWith("*.")) {
    return originHost.endsWith(patternHost.slice(1));
  }
  return patternHost === originHost;
};

const originMatchesPattern = (pattern: string, origin: string) => {
  if (pattern === "*") return true;
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    if (pattern.includes("*")) {
      if (pattern.includes("://")) {
        const [scheme, hostPattern] = pattern.split("://");
        if (`${originUrl.protocol.replace(":", "")}` !== scheme) return false;
        return hostMatches(hostPattern, originUrl.hostname);
      }
      return hostMatches(pattern, originUrl.hostname);
    }
    return origin === pattern;
  } catch {
    return origin === pattern;
  }
};

const getCorsDecision = (req: Request) => {
  const config = parseCorsConfig();
  const origin = req.headers.get("origin");
  if (config.origins.length === 0 && config.regexes.length === 0) {
    return { allowed: true, allowOrigin: "*", origin, allowedList: ["*"] };
  }
  if (!origin) {
    return {
      allowed: true,
      allowOrigin: config.origins[0] ?? "*",
      origin,
      allowedList: config.allowedList,
    };
  }
  const allowed =
    config.origins.some((pattern) => originMatchesPattern(pattern, origin)) ||
    config.regexes.some((regex) => regex.test(origin));
  return {
    allowed,
    allowOrigin: allowed ? origin : "null",
    origin,
    allowedList: config.allowedList,
  };
};

const buildCorsHeaders = (allowOrigin: string) => ({
  ...baseCorsHeaders,
  "Access-Control-Allow-Origin": allowOrigin,
});

const withCors = (allowOrigin: string, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers ?? {});
  const cors = buildCorsHeaders(allowOrigin);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
  return { ...init, headers };
};

const jsonResponse = (allowOrigin: string, payload: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), withCors(allowOrigin, { ...init, headers }));
};

serve(async (req) => {
  const corsDecision = getCorsDecision(req);

  if (req.method === "OPTIONS") {
    if (!corsDecision.allowed) {
      return jsonResponse(
        corsDecision.allowOrigin,
        {
          error: "CORS_ORIGIN_NOT_ALLOWED",
          origin: corsDecision.origin,
          allowed: corsDecision.allowedList,
        },
        { status: 403 }
      );
    }
    return new Response(null, withCors(corsDecision.allowOrigin, { status: 204 }));
  }

  if (!corsDecision.allowed) {
    return jsonResponse(
      corsDecision.allowOrigin,
      {
        error: "CORS_ORIGIN_NOT_ALLOWED",
        origin: corsDecision.origin,
        allowed: corsDecision.allowedList,
      },
      { status: 403 }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(
      corsDecision.allowOrigin,
      { error: "Supabase configuration missing." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader) {
    return jsonResponse(
      corsDecision.allowOrigin,
      { error: "Missing Authorization header." },
      { status: 401 }
    );
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse(
      corsDecision.allowOrigin,
      { error: "Auth required." },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseClient
    .from("action_logs")
    .select("created_at,intent,status,mode,payload")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return jsonResponse(
      corsDecision.allowOrigin,
      { error: error.message },
      { status: 500 }
    );
  }

  return jsonResponse(corsDecision.allowOrigin, { ok: true, rows: data ?? [] });
});
