import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { newRequestId, getProofSpineBuffer, type ProofSpineEntry } from "@/lib/proofSpine";
import { useAuth } from "@/hooks/useAuth";

type DebugProofPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightModeLabel: string;
};

type ProofLogRow = {
  created_at: string;
  intent: string;
  status: string;
  mode: string;
  payload: Record<string, unknown> | null;
};

type PreflightCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

type PreflightResult = {
  ok: boolean;
  checks: PreflightCheck[];
  checked_at: string;
  request_id: string;
};

const PREFLIGHT_KEY = "ppp:preflight";
const PREFLIGHT_READY_KEY = "ppp:preflightReady";

const loadPreflight = (): PreflightResult | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PREFLIGHT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PreflightResult;
  } catch {
    return null;
  }
};

const persistPreflight = (result: PreflightResult) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFLIGHT_KEY, JSON.stringify(result));
  window.localStorage.setItem(PREFLIGHT_READY_KEY, result.ok ? "true" : "false");
  window.dispatchEvent(new CustomEvent("ppp:preflight", { detail: result }));
};

export const DebugProofPanel = ({ open, onOpenChange, flightModeLabel }: DebugProofPanelProps) => {
  const { userId, email } = useAuth();
  const [localEntries, setLocalEntries] = useState<ProofSpineEntry[]>([]);
  const [serverRows, setServerRows] = useState<ProofLogRow[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonEnv = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseAnonKey = supabaseAnonEnv ?? supabasePublishableKey;
  const envReady = Boolean(supabaseUrl && supabaseAnonKey);
  const origin = typeof window !== "undefined" ? window.location.origin : "unknown";

  const lastAttempt = useMemo(() => localEntries[localEntries.length - 1] ?? null, [localEntries]);

  const refreshLocal = useCallback(() => {
    setLocalEntries(getProofSpineBuffer().slice(-10));
  }, []);

  useEffect(() => {
    if (!open) return;
    refreshLocal();
    setPreflight(loadPreflight());
  }, [open, refreshLocal]);

  useEffect(() => {
    if (!open) return;
    const handler = () => refreshLocal();
    window.addEventListener("proof-spine", handler as EventListener);
    window.addEventListener("ppp:preflight", handler as EventListener);
    return () => {
      window.removeEventListener("proof-spine", handler as EventListener);
      window.removeEventListener("ppp:preflight", handler as EventListener);
    };
  }, [open, refreshLocal]);

  const fetchServerLogs = useCallback(async () => {
    setServerLoading(true);
    setServerError(null);
    try {
      const { data, error } = await supabase.functions.invoke("proof-log");
      if (error) {
        setServerError(error.message);
        setServerRows([]);
      } else {
        setServerRows((data?.rows as ProofLogRow[]) ?? []);
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Unknown error");
      setServerRows([]);
    } finally {
      setServerLoading(false);
    }
  }, []);

  const runPreflight = useCallback(async () => {
    const checks: PreflightCheck[] = [];
    const requestId = newRequestId();
    const checkedAt = new Date().toISOString();

    if (!supabaseUrl) {
      checks.push({ key: "env_url", label: "Supabase URL", ok: false, detail: "Missing VITE_SUPABASE_URL." });
    } else {
      checks.push({ key: "env_url", label: "Supabase URL", ok: true, detail: "Present." });
    }

    if (!supabaseAnonKey) {
      checks.push({
        key: "env_anon",
        label: "Supabase anon key",
        ok: false,
        detail: "Missing VITE_SUPABASE_ANON_KEY.",
      });
    } else {
      checks.push({ key: "env_anon", label: "Supabase anon key", ok: true, detail: "Present." });
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      checks.push({ key: "auth", label: "Auth session", ok: false, detail: "No active session." });
    } else {
      checks.push({ key: "auth", label: "Auth session", ok: true, detail: "Session present." });
    }

    let edgeOk = false;
    if (supabaseUrl && accessToken) {
      try {
        const pingUrl = new URL(`${supabaseUrl}/functions/v1/ceo-agent/ping`);
        pingUrl.searchParams.set("request_id", requestId);
        const response = await fetch(pingUrl.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "X-Request-Id": requestId,
          },
        });
        edgeOk = response.ok;
        checks.push({
          key: "edge_ping",
          label: "Edge function reachable",
          ok: response.ok,
          detail: response.ok ? "Ping ok." : `Ping failed (${response.status}).`,
        });
      } catch (err) {
        checks.push({
          key: "edge_ping",
          label: "Edge function reachable",
          ok: false,
          detail: err instanceof Error ? err.message : "Ping failed.",
        });
      }
    } else {
      checks.push({
        key: "edge_ping",
        label: "Edge function reachable",
        ok: false,
        detail: "Missing URL or auth token.",
      });
    }

    let writeOk = false;
    if (userId) {
      const { error } = await supabase.from("action_logs").insert({
        user_id: userId,
        mode: "sim",
        intent: "preflight_check",
        status: "test",
        payload: { request_id: requestId, source: "debug_panel" },
      });
      writeOk = !error;
      checks.push({
        key: "action_logs_write",
        label: "action_logs write",
        ok: !error,
        detail: error ? error.message : "Write ok.",
      });
    } else {
      checks.push({
        key: "action_logs_write",
        label: "action_logs write",
        ok: false,
        detail: "No user id.",
      });
    }

    const integrationsOk = true;
    checks.push({
      key: "integrations",
      label: "Integrations available",
      ok: integrationsOk,
      detail: "Not required for debug actions.",
    });

    const ok = edgeOk && writeOk && checks.every((check) => check.ok);
    const result: PreflightResult = { ok, checks, checked_at: checkedAt, request_id: requestId };
    setPreflight(result);
    persistPreflight(result);
  }, [supabaseUrl, supabaseAnonKey, userId]);

  const localRows = useMemo(() => localEntries.slice().reverse(), [localEntries]);
  const handleCopyDebug = async () => {
    const payload = {
      mode: flightModeLabel,
      auth: { email: email ?? null, user_id: userId ?? null },
      env: {
        supabase_url_present: Boolean(supabaseUrl),
        supabase_anon_present: Boolean(supabaseAnonEnv),
        supabase_publishable_present: Boolean(supabasePublishableKey),
      },
      last_attempt: lastAttempt,
      buffer_tail: localEntries,
      preflight,
    };
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      }
    } catch (err) {
      console.error("[debug] copy failed", err);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-xl overflow-hidden">
        <SheetHeader>
          <SheetTitle>Debug Proof Panel</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-6rem)] pr-4">
          <div className="mt-4 space-y-6 text-sm">
            <section>
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Env / Config</div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span>VITE_SUPABASE_URL</span>
                  <Badge variant={supabaseUrl ? "default" : "outline"}>{supabaseUrl ? "yes" : "no"}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>VITE_SUPABASE_ANON_KEY</span>
                  <Badge variant={supabaseAnonEnv ? "default" : "outline"}>{supabaseAnonEnv ? "yes" : "no"}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Origin</span>
                  <span className="text-xs text-muted-foreground">{origin}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Current mode</span>
                  <Badge variant={flightModeLabel === "LIVE" ? "default" : "secondary"}>{flightModeLabel}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Env ready</span>
                  <Badge variant={envReady ? "default" : "outline"}>{envReady ? "yes" : "no"}</Badge>
                </div>
              </div>
            </section>
            <section>
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Auth</div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span>Email</span>
                  <span className="text-xs text-muted-foreground">{email ?? "unknown"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>User ID</span>
                  <span className="text-xs text-muted-foreground">{userId ?? "unknown"}</span>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Preflight gating</div>
              <div className="flex items-center gap-2">
                <Badge variant={preflight?.ok ? "default" : "outline"}>{preflight?.ok ? "ready" : "locked"}</Badge>
                <Button size="sm" variant="outline" onClick={runPreflight}>
                  Run preflight
                </Button>
              </div>
              {preflight ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Checked {new Date(preflight.checked_at).toLocaleString()} ({preflight.request_id})
                  </div>
                  {preflight.checks.map((check) => (
                    <div key={check.key} className="flex items-start justify-between gap-3">
                      <span>{check.label}</span>
                      <span className={check.ok ? "text-emerald-600" : "text-amber-700"}>
                        {check.ok ? "pass" : "fail"} - {check.detail}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-muted-foreground">No preflight results yet.</div>
              )}
            </section>

            <section>
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Last attempt (local proof)</div>
              <div className="mb-2">
                <Button size="sm" variant="outline" onClick={handleCopyDebug}>
                  Copy Debug JSON
                </Button>
              </div>
              {lastAttempt ? (
                <div className="space-y-2">
                  <div>request_id: {lastAttempt.request_id}</div>
                  <div>intent: {lastAttempt.intent}</div>
                  <div>timestamp: {new Date(lastAttempt.ts).toLocaleString()}</div>
                  <div>edge url: {lastAttempt.edge_url ?? "none"}</div>
                  <div>
                    status: {lastAttempt.edge_status ?? "unknown"}{" "}
                    {lastAttempt.edge_http_status ? `(${lastAttempt.edge_http_status})` : ""}
                  </div>
                  {lastAttempt.edge_error?.message && (
                    <div className="text-amber-700">
                      error: {lastAttempt.edge_error.message}
                      {lastAttempt.edge_error.stack ? ` | ${lastAttempt.edge_error.stack}` : ""}
                    </div>
                  )}
                  <div className="rounded border border-border bg-muted p-2 text-xs">
                    <div className="mb-1 font-semibold">edge response</div>
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(lastAttempt.edge_response ?? null, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No local attempts yet.</div>
              )}
              {localRows.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Recent attempts</div>
                  <div className="space-y-2">
                    {localRows.map((entry) => (
                      <div key={entry.request_id} className="rounded border border-border p-2 text-xs">
                        <div className="font-semibold">{entry.intent}</div>
                        <div>{entry.request_id}</div>
                        <div>{new Date(entry.ts).toLocaleString()}</div>
                        <div>{entry.edge_status ?? "unknown"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Server proof (action_logs)</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={fetchServerLogs} disabled={serverLoading}>
                  {serverLoading ? "Loading..." : "Refresh"}
                </Button>
                {serverError && <span className="text-xs text-amber-700">{serverError}</span>}
              </div>
              <div className="mt-3 space-y-2">
                {serverRows.length === 0 && !serverLoading && (
                  <div className="text-xs text-muted-foreground">No rows available.</div>
                )}
                {serverRows.map((row) => (
                  <div key={`${row.created_at}-${row.intent}`} className="rounded border border-border p-2 text-xs">
                    <div className="font-semibold">{row.intent}</div>
                    <div>{new Date(row.created_at).toLocaleString()}</div>
                    <div>
                      status: {row.status} | mode: {row.mode}
                    </div>
                    <div className="text-muted-foreground">
                      request_id: {row.payload?.request_id ?? "n/a"}
                    </div>
                    <div className="text-muted-foreground">
                      payload: {row.payload ? JSON.stringify(row.payload).slice(0, 120) : "n/a"}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default DebugProofPanel;
