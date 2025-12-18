import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Lead Normalize Edge Function (Production Hardened)
 * 
 * Normalizes, deduplicates, and segments incoming leads.
 * Creates/updates lead_profiles with deterministic fingerprinting.
 * 
 * Auth: Bearer JWT (admin/owner) OR X-Internal-Secret for system calls
 * 
 * RPC Function Signatures (must match exactly):
 * - normalize_email(raw_email text) -> text
 * - normalize_phone(raw_phone text) -> text
 * - compute_lead_fingerprint(p_email text, p_phone text, p_company_name text) -> text
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

interface NormalizeRequest {
  tenant_id: string;
  lead: {
    email?: string;
    phone?: string;
    company_name?: string;
    first_name?: string;
    last_name?: string;
    job_title?: string;
    source?: string;
    raw?: Record<string, unknown>;
  };
}

// Cache for audit log column check
let auditColumnsCache: { response_snapshot: boolean; user_id: boolean } | null = null;

// deno-lint-ignore no-explicit-any
async function checkAuditColumns(supabase: any): Promise<{ response_snapshot: boolean; user_id: boolean }> {
  if (auditColumnsCache) return auditColumnsCache;
  
  try {
    // Query platform_audit_log to check for column existence by selecting them
    // If columns don't exist, we'll get an error
    const { error: respError } = await supabase
      .from("platform_audit_log")
      .select("response_snapshot")
      .limit(0);
    
    const { error: userError } = await supabase
      .from("platform_audit_log")
      .select("user_id")
      .limit(0);
    
    auditColumnsCache = {
      response_snapshot: !respError,
      user_id: !userError,
    };
    return auditColumnsCache;
  } catch {
    return { response_snapshot: false, user_id: false };
  }
}

async function safeAuditInsert(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  auditData: Record<string, unknown>,
  auditColumns: { response_snapshot: boolean; user_id: boolean }
): Promise<void> {
  try {
    // deno-lint-ignore no-explicit-any
    const insertData: any = {
      tenant_id: auditData.tenant_id,
      timestamp: auditData.timestamp,
      agent_name: auditData.agent_name,
      action_type: auditData.action_type,
      entity_type: auditData.entity_type,
      entity_id: auditData.entity_id,
      description: auditData.description,
      request_snapshot: auditData.request_snapshot,
      success: auditData.success,
    };
    
    // Only include response_snapshot if column exists
    if (auditColumns.response_snapshot && auditData.response_snapshot !== undefined) {
      insertData.response_snapshot = auditData.response_snapshot;
    }
    
    // Only include user_id if column exists
    if (auditColumns.user_id && auditData.user_id !== undefined) {
      insertData.user_id = auditData.user_id;
    }
    
    const { error } = await supabase.from("platform_audit_log").insert(insertData);
    
    if (error) {
      console.warn("[lead-normalize] Audit insert failed (non-blocking)", error.message);
    }
  } catch (err) {
    console.warn("[lead-normalize] Audit insert exception (non-blocking)", err instanceof Error ? err.message : String(err));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const internalSecret = Deno.env.get("INTERNAL_SCHEDULER_SECRET");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error("[lead-normalize] Missing Supabase config");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    // Auth check: JWT or internal secret
    const authHeader = req.headers.get("Authorization");
    const internalSecretHeader = req.headers.get("X-Internal-Secret");
    
    let isAuthorized = false;
    let userId: string | null = null;
    let isSystemCall = false;

    // Check internal secret first (for system-to-system calls)
    if (internalSecret && internalSecretHeader === internalSecret) {
      isAuthorized = true;
      userId = "system";
      isSystemCall = true;
      console.log("[lead-normalize] Authorized via internal secret");
    }

    // Check JWT auth using ANON client (not service role)
    if (!isAuthorized && authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      
      // Use anon client to validate user JWT
      const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      
      const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
      
      if (authError || !user) {
        console.warn("[lead-normalize] JWT auth failed", { error: authError?.message });
        return jsonResponse({ error: "Unauthorized", details: authError?.message }, 401);
      }

      // Check user has admin or owner role using user-scoped client
      const { data: roles, error: rolesError } = await supabaseAnon
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (rolesError) {
        console.warn("[lead-normalize] Role lookup failed", { error: rolesError.message });
        return jsonResponse({ error: "Failed to verify permissions" }, 500);
      }

      const hasRole = roles?.some((r: { role: string }) => ["admin", "owner", "platform_admin"].includes(r.role));
      if (!hasRole) {
        console.warn("[lead-normalize] Insufficient role", { user_id: user.id, roles });
        return jsonResponse({ error: "Insufficient permissions", required: ["admin", "owner"] }, 403);
      }

      isAuthorized = true;
      userId = user.id;
      console.log("[lead-normalize] Authorized via JWT", { user_id: user.id });
    }

    if (!isAuthorized) {
      return jsonResponse({ error: "Unauthorized", hint: "Provide Bearer token or X-Internal-Secret" }, 401);
    }

    // Parse request
    const body: NormalizeRequest = await req.json().catch(() => ({ tenant_id: "", lead: {} }));
    
    if (!body.tenant_id) {
      return jsonResponse({ error: "tenant_id is required" }, 400);
    }

    const { lead } = body;
    if (!lead.email && !lead.phone) {
      return jsonResponse({ error: "At least one of email or phone is required" }, 400);
    }

    // Create service role client for DB write operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Check which audit columns exist (cached)
    const auditColumns = await checkAuditColumns(supabase);

    // Validate tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", body.tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.warn("[lead-normalize] Invalid tenant", { tenant_id: body.tenant_id, error: tenantError?.message });
      return jsonResponse({ error: "Invalid tenant_id" }, 400);
    }

    // Compute fingerprint using SQL function
    // RPC argument names: p_email, p_phone, p_company_name (match function signature)
    const { data: fpResult, error: fpError } = await supabase.rpc("compute_lead_fingerprint", {
      p_email: lead.email || null,
      p_phone: lead.phone || null,
      p_company_name: lead.company_name || null,
    });

    if (fpError) {
      console.error("[lead-normalize] Fingerprint computation failed", { 
        error: fpError.message, 
        code: fpError.code,
        hint: "Check if compute_lead_fingerprint function exists and pgcrypto is enabled"
      });
      return jsonResponse({ error: "Failed to compute fingerprint", details: fpError.message }, 500);
    }

    const fingerprint = fpResult as string;

    // Get normalized values
    // RPC argument names: raw_email, raw_phone (match function signatures)
    const { data: normEmail, error: emailError } = await supabase.rpc("normalize_email", { 
      raw_email: lead.email || null 
    });
    const { data: normPhone, error: phoneError } = await supabase.rpc("normalize_phone", { 
      raw_phone: lead.phone || null 
    });

    if (emailError || phoneError) {
      console.error("[lead-normalize] Normalization RPC failed", { 
        emailError: emailError?.message, 
        phoneError: phoneError?.message 
      });
      return jsonResponse({ 
        error: "Normalization failed", 
        details: { email: emailError?.message, phone: phoneError?.message } 
      }, 500);
    }

    // Determine segment (lightweight rules)
    let segment: "b2b" | "b2c" | "unknown" = "unknown";
    if (lead.company_name || lead.job_title) {
      segment = "b2b";
    } else if (lead.email && !lead.email.includes("@gmail.") && !lead.email.includes("@yahoo.") && !lead.email.includes("@hotmail.")) {
      segment = "b2b";
    } else if (lead.email || lead.phone) {
      segment = "b2c";
    }

    // Check if existing profile with same fingerprint exists
    const { data: existingProfile, error: existingError } = await supabase
      .from("lead_profiles")
      .select("id, lead_id, merged_from, enrichment_data, company_name, job_title, segment")
      .eq("tenant_id", body.tenant_id)
      .eq("fingerprint", fingerprint)
      .eq("is_primary", true)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      console.error("[lead-normalize] Profile lookup failed", { error: existingError.message });
      return jsonResponse({ error: "Database error during lookup", details: existingError.message }, 500);
    }

    let leadId: string;
    let leadProfileId: string;
    let status: "created" | "deduped";

    if (existingProfile) {
      // DEDUP PATH: Update existing profile
      status = "deduped";
      leadProfileId = existingProfile.id;
      leadId = existingProfile.lead_id;

      // Build enrichment data merge (dedupe sources array)
      const existingEnrichment = (existingProfile.enrichment_data || {}) as Record<string, unknown>;
      const existingSources = Array.isArray(existingEnrichment.sources) ? existingEnrichment.sources : [];
      const newSource = lead.source;
      const mergedSources = newSource && !existingSources.includes(newSource) 
        ? [...existingSources, newSource]
        : existingSources;

      const newEnrichment = {
        ...existingEnrichment,
        last_seen_at: new Date().toISOString(),
        sources: mergedSources,
      };

      // Build update object with only changed fields
      // deno-lint-ignore no-explicit-any
      const updateFields: Record<string, any> = {
        enrichment_data: newEnrichment,
      };

      // Only update company_name if provided and not already set
      if (lead.company_name && !existingProfile.company_name) {
        updateFields.company_name = lead.company_name;
      }

      // Only update job_title if provided and not already set
      if (lead.job_title && !existingProfile.job_title) {
        updateFields.job_title = lead.job_title;
      }

      // Only update segment if new segment is more specific
      if (segment !== "unknown" && existingProfile.segment === "unknown") {
        updateFields.segment = segment;
      }

      const { error: updateError } = await supabase
        .from("lead_profiles")
        .update(updateFields)
        .eq("id", existingProfile.id);

      if (updateError) {
        console.error("[lead-normalize] Profile update failed", { error: updateError.message });
        return jsonResponse({ error: "Failed to update existing profile", details: updateError.message }, 500);
      }

      // Log audit entry (non-blocking)
      await safeAuditInsert(supabase, {
        tenant_id: body.tenant_id,
        timestamp: new Date().toISOString(),
        agent_name: "lead-normalize",
        action_type: "lead_normalize_called",
        entity_type: "lead",
        entity_id: leadId,
        description: `Lead normalized (deduped) - fingerprint: ${fingerprint}`,
        request_snapshot: { input: body, normalized: { email: normEmail, phone: normPhone } },
        response_snapshot: { status: "deduped", lead_profile_id: leadProfileId, fingerprint },
        success: true,
        user_id: isSystemCall ? null : userId,
      }, auditColumns);

    } else {
      // CREATE PATH: New lead + profile
      status = "created";

      const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";

      // Insert lead record
      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          tenant_id: body.tenant_id,
          name: leadName,
          email: normEmail,
          phone: normPhone,
          business_name: lead.company_name,
          source: lead.source || "lead-normalize",
          status: "new",
          lead_temperature: "cold",
          metadata: { raw: lead.raw, normalized_at: new Date().toISOString() },
        })
        .select("id")
        .single();

      if (leadError) {
        console.error("[lead-normalize] Lead creation failed", { error: leadError.message });
        return jsonResponse({ error: "Failed to create lead", details: leadError.message }, 500);
      }

      leadId = newLead.id;

      // Insert lead_profile
      const { data: newProfile, error: profileError } = await supabase
        .from("lead_profiles")
        .insert({
          lead_id: leadId,
          tenant_id: body.tenant_id,
          fingerprint,
          segment,
          temperature: "ice_cold",
          company_name: lead.company_name || null,
          job_title: lead.job_title || null,
          is_primary: true,
          enrichment_data: {
            sources: lead.source ? [lead.source] : [],
            created_at: new Date().toISOString(),
          },
        })
        .select("id")
        .single();

      if (profileError) {
        console.error("[lead-normalize] Profile creation failed", { error: profileError.message });
        // Cleanup lead on failure
        await supabase.from("leads").delete().eq("id", leadId);
        return jsonResponse({ error: "Failed to create lead profile", details: profileError.message }, 500);
      }

      leadProfileId = newProfile.id;

      // Log audit entry (non-blocking)
      await safeAuditInsert(supabase, {
        tenant_id: body.tenant_id,
        timestamp: new Date().toISOString(),
        agent_name: "lead-normalize",
        action_type: "lead_normalize_called",
        entity_type: "lead",
        entity_id: leadId,
        description: `Lead normalized (created) - fingerprint: ${fingerprint}`,
        request_snapshot: { input: body, normalized: { email: normEmail, phone: normPhone } },
        response_snapshot: { status: "created", lead_id: leadId, lead_profile_id: leadProfileId, fingerprint },
        success: true,
        user_id: isSystemCall ? null : userId,
      }, auditColumns);
    }

    const durationMs = Date.now() - startTime;
    console.log("[lead-normalize] Success", {
      status,
      tenant_id: body.tenant_id,
      lead_id: leadId,
      lead_profile_id: leadProfileId,
      fingerprint,
      segment,
      duration_ms: durationMs,
    });

    return jsonResponse({
      ok: true,
      status,
      tenant_id: body.tenant_id,
      lead_id: leadId,
      lead_profile_id: leadProfileId,
      fingerprint,
      segment,
      normalized: { email: normEmail, phone: normPhone },
      duration_ms: durationMs,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[lead-normalize] Unhandled error", { error: errorMsg });
    return jsonResponse({ error: "Internal server error", details: errorMsg }, 500);
  }
});
