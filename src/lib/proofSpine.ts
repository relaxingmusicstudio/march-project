import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProofSpineEntry = {
  request_id: string;
  intent: string;
  mode: string;
  payload?: Record<string, unknown>;
  ts: string;
  origin: string;
  db_ok?: boolean;
  db_error?: string;
  edge_url?: string;
  edge_status?: "ok" | "error";
  edge_http_status?: number;
  edge_response?: unknown;
  edge_error?: { message?: string; stack?: string };
  edge_ts?: string;
};

type UiAttemptInput = {
  intent: string;
  mode: string;
  payload?: Record<string, unknown>;
  request_id: string;
};

const BUFFER_KEY = "proof_spine_buffer";
const MAX_ENTRIES = 25;

const readBuffer = (): ProofSpineEntry[] => {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProofSpineEntry[]) : [];
  } catch {
    return [];
  }
};

const writeBuffer = (entries: ProofSpineEntry[]) => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(BUFFER_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage write failures
  }
};

const emitUpdate = (entry: ProofSpineEntry) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("proof-spine", { detail: entry }));
};

const randomFragment = () => {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2, 10);
};

export const newRequestId = (): string => `ps_${Date.now().toString(36)}_${randomFragment()}`;

export const getProofSpineTail = (limit = 5): ProofSpineEntry[] => {
  const buffer = readBuffer();
  return buffer.slice(Math.max(0, buffer.length - limit));
};

export const getProofSpineBuffer = (): ProofSpineEntry[] => readBuffer();

export const recordUiAttempt = async (input: UiAttemptInput): Promise<ProofSpineEntry> => {
  const entry: ProofSpineEntry = {
    request_id: input.request_id,
    intent: input.intent,
    mode: input.mode,
    payload: input.payload,
    ts: new Date().toISOString(),
    origin: typeof window !== "undefined" ? window.location.origin : "unknown",
  };

  const buffer = [...readBuffer(), entry].slice(-MAX_ENTRIES);
  writeBuffer(buffer);
  emitUpdate(entry);

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error("[proofSpine] auth unavailable", authError ?? "no session");
      toast.warning("Proof log failed: no active session.");
      const updated = { ...entry, db_ok: false, db_error: authError?.message ?? "no session" };
      const latest = readBuffer();
      if (latest.length > 0 && latest[latest.length - 1].request_id === entry.request_id) {
        latest[latest.length - 1] = updated;
        writeBuffer(latest);
      }
      emitUpdate(updated);
      return updated;
    }

    const { error } = await supabase.from("action_logs").insert({
      user_id: authData.user.id,
      mode: input.mode,
      status: "attempted",
      intent: input.intent,
      payload: {
        request_id: input.request_id,
        origin: entry.origin,
        ...(input.payload ?? {}),
      },
    });

    if (error) {
      console.error("[proofSpine] insert failed", error);
      toast.warning("Proof log failed to record.");
      const updated = { ...entry, db_ok: false, db_error: error.message };
      const latest = readBuffer();
      if (latest.length > 0 && latest[latest.length - 1].request_id === entry.request_id) {
        latest[latest.length - 1] = updated;
        writeBuffer(latest);
      }
      emitUpdate(updated);
      return updated;
    }
    const updated = { ...entry, db_ok: true };
    const latest = readBuffer();
    if (latest.length > 0 && latest[latest.length - 1].request_id === entry.request_id) {
      latest[latest.length - 1] = updated;
      writeBuffer(latest);
    }
    emitUpdate(updated);
    return updated;
  } catch (err) {
    console.error("[proofSpine] insert exception", err);
    toast.warning("Proof log failed to record.");
    const updated = { ...entry, db_ok: false, db_error: err instanceof Error ? err.message : "unknown" };
    const latest = readBuffer();
    if (latest.length > 0 && latest[latest.length - 1].request_id === entry.request_id) {
      latest[latest.length - 1] = updated;
      writeBuffer(latest);
    }
    emitUpdate(updated);
    return updated;
  }
};

type EdgeResponseInput = {
  request_id: string;
  edge_url: string;
  status: "ok" | "error";
  http_status?: number;
  response?: unknown;
  error?: { message?: string; stack?: string };
};

export const recordEdgeResponse = (input: EdgeResponseInput): ProofSpineEntry | null => {
  const buffer = readBuffer();
  const index = buffer.findIndex((entry) => entry.request_id === input.request_id);
  if (index === -1) return null;
  const updated: ProofSpineEntry = {
    ...buffer[index],
    edge_url: input.edge_url,
    edge_status: input.status,
    edge_http_status: input.http_status,
    edge_response: input.response,
    edge_error: input.error,
    edge_ts: new Date().toISOString(),
  };
  buffer[index] = updated;
  writeBuffer(buffer);
  emitUpdate(updated);
  return updated;
};
