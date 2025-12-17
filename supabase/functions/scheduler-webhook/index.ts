import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * External Scheduler Webhook - For external cron triggers (GitHub Actions, Cloudflare, GCP)
 * 
 * REQUIRES: X-Internal-Secret header matching INTERNAL_SCHEDULER_SECRET
 * 
 * This allows external services to trigger scheduler actions without JWT auth.
 * Use this when pg_cron is unavailable or as a backup trigger mechanism.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Verify internal secret
    const providedSecret = req.headers.get("X-Internal-Secret");
    const expectedSecret = Deno.env.get("INTERNAL_SCHEDULER_SECRET");

    if (!expectedSecret) {
      console.error("[scheduler-webhook] INTERNAL_SCHEDULER_SECRET not configured");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
      console.warn("[scheduler-webhook] Unauthorized access attempt");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { action, tenant_ids } = body as { action?: string; tenant_ids?: string[] };

    if (!action) {
      return jsonResponse({ error: "Missing required field: action" }, 400);
    }

    // Validate action
    const allowedActions = ["run_daily_briefs", "run_cost_rollup", "run_outreach_queue", "check_job_status"];
    if (!allowedActions.includes(action)) {
      return jsonResponse({ error: `Invalid action. Allowed: ${allowedActions.join(", ")}` }, 400);
    }

    // Initialize service client for audit logging
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    // Call ceo-scheduler internally
    const schedulerUrl = `${supabaseUrl}/functions/v1/ceo-scheduler`;
    const schedulerBody: Record<string, unknown> = { action };
    if (tenant_ids && Array.isArray(tenant_ids)) {
      schedulerBody.tenant_ids = tenant_ids;
    }

    console.log("[scheduler-webhook] Calling ceo-scheduler", { action });

    const schedulerResponse = await fetch(schedulerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": expectedSecret,
      },
      body: JSON.stringify(schedulerBody),
    });

    const schedulerResult = await schedulerResponse.json();

    // Log to platform_audit_log if service role key available
    if (serviceRoleKey) {
      const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      await serviceClient.from("platform_audit_log").insert({
        action_type: "external_cron_trigger",
        entity_type: "scheduler",
        entity_id: action,
        description: `External webhook triggered scheduler action: ${action}`,
        request_snapshot: { action, tenant_ids, source: "external_webhook" },
        response_snapshot: { status: schedulerResponse.status, result: schedulerResult },
        success: schedulerResponse.ok,
        duration_ms: Date.now() - startTime,
      });
    }

    if (!schedulerResponse.ok) {
      console.error("[scheduler-webhook] Scheduler call failed", {
        status: schedulerResponse.status,
        result: schedulerResult,
      });
      return jsonResponse({
        error: "Scheduler call failed",
        scheduler_error: schedulerResult,
      }, schedulerResponse.status);
    }

    return jsonResponse({
      success: true,
      action,
      result: schedulerResult,
      source: "external_webhook",
      duration_ms: Date.now() - startTime,
    });

  } catch (error) {
    console.error("[scheduler-webhook] Unhandled error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
