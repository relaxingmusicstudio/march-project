import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Admin Scheduler Status - Returns scheduler configuration + job status
 * 
 * Uses SERVICE_ROLE_KEY to query:
 * - DB RPC: check_scheduler_secret_configured() 
 * - DB RPC: get_scheduler_jobs()
 * - platform_audit_log (recent scheduler activity)
 * 
 * REQUIRES: verify_jwt = true in config.toml
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SchedulerJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: string | null;
  last_status: string | null;
}

interface AuditLog {
  id: string;
  action_type: string;
  entity_id: string;
  description: string;
  success: boolean;
  created_at: string;
  duration_ms: number | null;
}

// Map jobname substrings to scheduler action for audit log correlation
function getActionFromJobname(jobname: string): string | null {
  const lower = jobname.toLowerCase();
  if (lower.includes("daily") || lower.includes("brief")) return "run_daily_briefs";
  if (lower.includes("cost") || lower.includes("rollup")) return "run_cost_rollup";
  if (lower.includes("outreach")) return "run_outreach_queue";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("[admin-scheduler-status] Missing Supabase config");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    // Verify user is authenticated and has admin role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("[admin-scheduler-status] Auth failed", { error: userError?.message });
      return jsonResponse({ error: "Authentication failed" }, 401);
    }

    // Check admin role
    const { data: roleData, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("[admin-scheduler-status] Role check failed", { error: roleError.message });
      return jsonResponse({ error: "Failed to verify permissions" }, 500);
    }

    if (!roleData) {
      console.warn("[admin-scheduler-status] Non-admin access attempt", { user_id: user.id });
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    // Use service role client for privileged queries
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Check if internal scheduler secret is configured via RPC
    let secretConfigured = false;
    try {
      const { data: secretData, error: secretError } = await serviceClient.rpc(
        "check_scheduler_secret_configured"
      );
      if (!secretError) {
        secretConfigured = Boolean(secretData);
      }
    } catch (e) {
      console.log("[admin-scheduler-status] check_scheduler_secret_configured RPC failed, checking env", e);
      // Fallback: check if env var is set
      secretConfigured = Boolean(Deno.env.get("INTERNAL_SCHEDULER_SECRET"));
    }

    // Query scheduler jobs via RPC (avoids PostgREST limitation on cron schema)
    const jobs: SchedulerJob[] = [];
    const defaultJobs: SchedulerJob[] = [
      { jobid: 1, jobname: "ceo-daily-briefs", schedule: "0 6 * * *", active: true, last_run: null, last_status: null },
      { jobid: 2, jobname: "ceo-cost-rollup", schedule: "0 */6 * * *", active: true, last_run: null, last_status: null },
      { jobid: 3, jobname: "ceo-outreach-queue", schedule: "*/15 * * * *", active: true, last_run: null, last_status: null },
    ];

    try {
      const { data: cronJobs, error: cronError } = await serviceClient.rpc("get_scheduler_jobs");
      
      if (!cronError && cronJobs && Array.isArray(cronJobs) && cronJobs.length > 0) {
        for (const job of cronJobs) {
          jobs.push({
            jobid: Number(job.jobid),
            jobname: String(job.jobname),
            schedule: String(job.schedule),
            active: Boolean(job.active),
            last_run: null,
            last_status: null,
          });
        }
        console.log("[admin-scheduler-status] Loaded jobs from RPC", { count: jobs.length });
      } else {
        // RPC returned empty or failed, use defaults
        console.log("[admin-scheduler-status] RPC returned empty, using defaults", { 
          error: cronError?.message,
          dataLength: cronJobs?.length 
        });
        jobs.push(...defaultJobs);
      }
    } catch (e) {
      // RPC likely doesn't exist or failed
      console.log("[admin-scheduler-status] get_scheduler_jobs RPC failed, using defaults", e);
      jobs.push(...defaultJobs);
    }

    // Get recent audit logs for scheduler
    const { data: auditLogs, error: auditError } = await serviceClient
      .from("platform_audit_log")
      .select("id, action_type, entity_id, description, success, created_at, duration_ms")
      .eq("entity_type", "scheduler")
      .order("created_at", { ascending: false })
      .limit(50);

    if (auditError) {
      console.error("[admin-scheduler-status] Audit log query failed", { error: auditError.message });
    }

    const logs: AuditLog[] = (auditLogs || []).map(log => ({
      id: log.id,
      action_type: log.action_type,
      entity_id: log.entity_id,
      description: log.description,
      success: log.success,
      created_at: log.created_at,
      duration_ms: log.duration_ms,
    }));

    // Correlate audit logs with jobs to get last_run/last_status
    for (const job of jobs) {
      const matchingAction = getActionFromJobname(job.jobname);
      
      if (matchingAction) {
        // Find latest audit log for this action
        const latestLog = logs.find(l => l.entity_id === matchingAction);
        if (latestLog) {
          job.last_run = latestLog.created_at;
          job.last_status = latestLog.success ? "succeeded" : "failed";
        }
      }
    }

    console.log("[admin-scheduler-status] Returning status", { 
      secret_configured: secretConfigured, 
      jobs_count: jobs.length,
      logs_count: logs.length,
      user_id: user.id,
    });

    return jsonResponse({
      secret_configured: secretConfigured,
      jobs,
      audit_logs: logs.slice(0, 20), // Return max 20 logs to UI
    });

  } catch (error) {
    console.error("[admin-scheduler-status] Unhandled error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
