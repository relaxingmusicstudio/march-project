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
 * Allows both "admin" and "owner" roles
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
  timestamp: string; // Using 'timestamp' consistently (not created_at)
  duration_ms: number | null;
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

    // Verify user is authenticated and has admin/owner role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("[admin-scheduler-status] Auth failed", { error: userError?.message });
      return jsonResponse({ error: "Authentication failed" }, 401);
    }

    // Check if user has admin OR owner role
    const { data: roleData, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "owner"]);

    if (roleError) {
      console.error("[admin-scheduler-status] Role check failed", { error: roleError.message });
      return jsonResponse({ error: "Failed to verify permissions" }, 500);
    }

    if (!roleData || roleData.length === 0) {
      console.warn("[admin-scheduler-status] Unauthorized access attempt", { user_id: user.id });
      return jsonResponse({ error: "Admin or owner access required" }, 403);
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

    // Query scheduler jobs via RPC - now includes last_run and last_status
    let jobs: SchedulerJob[] = [];
    const defaultJobs: SchedulerJob[] = [
      { jobid: 1, jobname: "ceo-scheduler-daily-briefs", schedule: "0 6 * * *", active: true, last_run: null, last_status: null },
      { jobid: 2, jobname: "ceo-scheduler-cost-rollup", schedule: "0 */6 * * *", active: true, last_run: null, last_status: null },
      { jobid: 3, jobname: "ceo-scheduler-outreach-queue", schedule: "*/15 * * * *", active: true, last_run: null, last_status: null },
    ];

    try {
      const { data: cronJobs, error: cronError } = await serviceClient.rpc("get_scheduler_jobs");
      
      if (!cronError && cronJobs && Array.isArray(cronJobs) && cronJobs.length > 0) {
        jobs = cronJobs.map((job: { jobid: number; jobname: string; schedule: string; active: boolean; last_run: string | null; last_status: string | null }) => ({
          jobid: Number(job.jobid),
          jobname: String(job.jobname),
          schedule: String(job.schedule),
          active: Boolean(job.active),
          last_run: job.last_run || null,
          last_status: job.last_status || null,
        }));
        console.log("[admin-scheduler-status] Loaded jobs from RPC", { count: jobs.length });
      } else {
        console.log("[admin-scheduler-status] RPC returned empty, using defaults", { 
          error: cronError?.message,
          dataLength: cronJobs?.length 
        });
        jobs = [...defaultJobs];
      }
    } catch (e) {
      console.log("[admin-scheduler-status] get_scheduler_jobs RPC failed, using defaults", e);
      jobs = [...defaultJobs];
    }

    // Get recent audit logs for scheduler (use 'timestamp' field consistently)
    const { data: auditLogs, error: auditError } = await serviceClient
      .from("platform_audit_log")
      .select("id, action_type, entity_id, description, success, timestamp, duration_ms")
      .eq("entity_type", "scheduler")
      .order("timestamp", { ascending: false })
      .limit(50);

    if (auditError) {
      console.error("[admin-scheduler-status] Audit log query failed", { error: auditError.message });
    }

    // Use 'timestamp' directly - no mapping needed
    const logs: AuditLog[] = (auditLogs || []).map(log => ({
      id: log.id,
      action_type: log.action_type,
      entity_id: log.entity_id,
      description: log.description,
      success: log.success,
      timestamp: log.timestamp,
      duration_ms: log.duration_ms,
    }));

    console.log("[admin-scheduler-status] Returning status", { 
      secret_configured: secretConfigured, 
      jobs_count: jobs.length,
      logs_count: logs.length,
      user_id: user.id,
    });

    // Return logs with 'timestamp' field (UI should use this directly)
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
