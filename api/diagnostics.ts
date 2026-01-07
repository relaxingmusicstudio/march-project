import { createClient } from "@supabase/supabase-js";

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

const getHeader = (req: ApiRequest, name: string) => {
  const key = name.toLowerCase();
  const value = req.headers?.[key] ?? req.headers?.[name];
  if (Array.isArray(value)) return value[0];
  return value ? String(value) : undefined;
};

const getBearerToken = (req: ApiRequest) => {
  const auth = getHeader(req, "authorization");
  if (!auth) return null;
  const match = auth.match(/Bearer\s+(.+)/i);
  return match ? match[1] : null;
};

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnon =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const adminToken = process.env.DIAGNOSTICS_ADMIN_TOKEN || "";

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnon);

const buildSupabaseClient = (token?: string) =>
  createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });

export default async function diagnosticsHandler(req: ApiRequest, res: ApiResponse) {
  const method = req.method?.toUpperCase() || "GET";
  if (method !== "GET") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const envOk = {
    VITE_SUPABASE_URL: Boolean(process.env.VITE_SUPABASE_URL),
    VITE_SUPABASE_ANON_KEY: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
    DIAGNOSTICS_ADMIN_TOKEN: Boolean(process.env.DIAGNOSTICS_ADMIN_TOKEN),
  };

  let authorized = false;
  if (hasSupabaseConfig) {
    const bearer = getBearerToken(req);
    if (bearer) {
      const supabase = buildSupabaseClient(bearer);
      const { data, error } = await supabase.rpc("has_role", { role: "admin" });
      authorized = Boolean(data) && !error;
    }
  }

  if (!authorized && adminToken) {
    const token = getHeader(req, "x-admin-token");
    authorized = Boolean(token && token === adminToken);
  }

  const responsePayload: Record<string, unknown> = {
    sha: getSha(),
    db_ok: false,
    guardrails_ok: false,
    required_functions: {
      app_role: false,
      has_role: false,
    },
    env_ok: envOk,
  };

  if (!authorized) {
    sendJson(res, 401, { ...responsePayload, error: "unauthorized" });
    return;
  }

  if (!hasSupabaseConfig) {
    sendJson(res, 200, responsePayload);
    return;
  }

  const supabase = buildSupabaseClient();

  const { data: appRoleType } = await supabase.rpc("db_to_regtype", {
    p_name: "public.app_role",
  });
  const appRoleOk = Boolean(appRoleType);

  const { data: hasRoleSig } = await supabase.rpc("db_to_regprocedure", {
    p_name: "public.has_role(text, uuid)",
  });
  const hasRoleOk = Boolean(hasRoleSig);

  const tableChecks: Record<string, boolean> = {};
  const tables = [
    "public.visitors",
    "public.action_logs",
    "public.ceo_conversations",
    "public.onboarding_state",
  ];
  for (const table of tables) {
    const { data } = await supabase.rpc("db_to_regclass", { p_name: table });
    tableChecks[table] = Boolean(data);
  }

  const tablesOk = Object.values(tableChecks).every(Boolean);
  const dbOk = appRoleOk && hasRoleOk && tablesOk;

  responsePayload.db_ok = dbOk;
  responsePayload.guardrails_ok = dbOk;
  responsePayload.required_functions = {
    app_role: appRoleOk,
    has_role: hasRoleOk,
  };

  sendJson(res, 200, responsePayload);
}
