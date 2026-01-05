import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LogActionInput = {
  mode: string;
  status: string;
  intent: string;
  payload?: Record<string, unknown>;
  proof?: Record<string, unknown>;
};

export type LogActionResult = {
  ok: boolean;
  mode: string;
  status: string;
  intent: string;
  at: string;
  error?: string;
};

const buildResult = (input: LogActionInput, ok: boolean, error?: string): LogActionResult => ({
  ok,
  mode: input.mode,
  status: input.status,
  intent: input.intent,
  at: new Date().toISOString(),
  ...(error ? { error } : {}),
});

export async function logAction(input: LogActionInput): Promise<LogActionResult> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    const message = authError?.message ?? "No active session";
    console.error("[logAction] auth unavailable", authError ?? message);
    toast.warning("Action log failed: no active session.");
    return buildResult(input, false, message);
  }

  const { error } = await supabase.from("action_logs").insert({
    user_id: authData.user.id,
    mode: input.mode,
    status: input.status,
    intent: input.intent,
    payload: input.payload ?? null,
    proof: input.proof ?? null,
  });

  if (error) {
    console.error("[logAction] insert failed", error);
    toast.warning("Action log failed to record.");
    return buildResult(input, false, error.message);
  }

  return buildResult(input, true);
}
