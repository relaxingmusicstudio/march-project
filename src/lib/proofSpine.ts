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
};

type UiAttemptInput = {
  intent: string;
  mode: string;
  payload?: Record<string, unknown>;
  request_id: string;
};

const BUFFER_KEY = "proof_spine_buffer";
const MAX_ENTRIES = 50;

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
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("proof-spine", { detail: entry }));
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error("[proofSpine] auth unavailable", authError ?? "no session");
      toast.warning("Proof log failed: no active session.");
      return { ...entry, db_ok: false, db_error: authError?.message ?? "no session" };
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
      return updated;
    }
    const updated = { ...entry, db_ok: true };
    const latest = readBuffer();
    if (latest.length > 0 && latest[latest.length - 1].request_id === entry.request_id) {
      latest[latest.length - 1] = updated;
      writeBuffer(latest);
    }
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
    return updated;
  }
};
