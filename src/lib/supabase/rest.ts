type SupabaseRestConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseRestResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  unauthorized: boolean;
};

export type SupabaseRestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string>;
  prefer?: string;
  signal?: AbortSignal;
};

const getSupabaseRestConfig = (): SupabaseRestConfig | null => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

export const isSupabaseRestConfigured = (): boolean => Boolean(getSupabaseRestConfig());

const buildRestUrl = (baseUrl: string, path: string, query?: Record<string, string>): string => {
  const trimmedBase = baseUrl.replace(/\/$/, "");
  const url = new URL(`${trimmedBase}/rest/v1/${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
};

export const supabaseRestRequest = async <T>(
  path: string,
  options: SupabaseRestOptions = {}
): Promise<SupabaseRestResult<T>> => {
  const config = getSupabaseRestConfig();
  if (!config) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "supabase_env_missing",
      unauthorized: true,
    };
  }

  const url = buildRestUrl(config.url, path, options.query);
  const headers: Record<string, string> = {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      unauthorized: false,
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      status: response.status,
      data: null,
      error: response.statusText || "unauthorized",
      unauthorized: true,
    };
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      message = await response.text();
    } catch {
      // Ignore parsing failure.
    }
    return {
      ok: false,
      status: response.status,
      data: null,
      error: message || "request_failed",
      unauthorized: false,
    };
  }

  if (response.status === 204) {
    return {
      ok: true,
      status: response.status,
      data: null,
      error: null,
      unauthorized: false,
    };
  }

  try {
    const data = (await response.json()) as T;
    return {
      ok: true,
      status: response.status,
      data,
      error: null,
      unauthorized: false,
    };
  } catch (error) {
    return {
      ok: false,
      status: response.status,
      data: null,
      error: error instanceof Error ? error.message : "invalid_json",
      unauthorized: false,
    };
  }
};
