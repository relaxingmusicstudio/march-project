import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChat, estimateCostCents, AIChatResponse } from "../_shared/ai.ts";

/**
 * CEO Scheduler - Automated daily brief generation per-tenant
 * 
 * SECURITY: Requires X-Internal-Secret header. Internal use only via pg_cron.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface BriefData {
  leads_24h: number;
  lead_temperature: Record<string, number>;
  missed_calls_24h: number;
  total_calls_24h: number;
  active_clients: number;
  mrr_cents: number;
  revenue_invoiced_this_month_cents: number;
  ai_cost_24h_cents: number;
  ai_cost_30d_avg_cents: number;
  top_lead_sources: Array<{ source: string; count: number }>;
  pending_actions: number;
}

function validateInternalAuth(req: Request): { valid: boolean; error?: string } {
  const secret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_SCHEDULER_SECRET');

  if (!expectedSecret) {
    console.error('[ceo-scheduler] INTERNAL_SCHEDULER_SECRET not configured');
    return { valid: false, error: 'Internal auth not configured' };
  }
  if (!secret) {
    return { valid: false, error: 'Missing X-Internal-Secret header' };
  }
  if (secret !== expectedSecret) {
    return { valid: false, error: 'Invalid X-Internal-Secret' };
  }
  return { valid: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authCheck = validateInternalAuth(req);
  if (!authCheck.valid) {
    console.warn(`[ceo-scheduler] Auth rejected: ${authCheck.error}`);
    return jsonResponse({ error: authCheck.error }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action = 'run_daily_briefs', tenant_ids } = await req.json().catch(() => ({}));
    console.log(`[ceo-scheduler] Action: ${action}`);

    switch (action) {
      case 'run_daily_briefs':
        return await runDailyBriefs(supabase, tenant_ids);
      case 'run_cost_rollup':
        return await runCostRollup(supabase);
      case 'check_job_status':
        return await checkJobStatus(supabase);
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error('[ceo-scheduler] Error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

async function runDailyBriefs(supabase: SupabaseClient, specificTenantIds?: string[]): Promise<Response> {
  const startTime = Date.now();

  // Query tenants - use is_active (check actual schema)
  let query = supabase.from('tenants').select('id, name');
  
  // Filter by is_active or status depending on schema
  query = query.eq('is_active', true);

  if (specificTenantIds?.length) {
    query = query.in('id', specificTenantIds);
  }

  const { data: tenants, error: tenantsError } = await query;

  if (tenantsError) {
    console.error('[ceo-scheduler] Failed to fetch tenants:', tenantsError);
    return jsonResponse({ error: 'Failed to fetch tenants' }, 500);
  }

  if (!tenants?.length) {
    console.log('[ceo-scheduler] No active tenants found');
    return jsonResponse({ message: 'No active tenants', processed: 0 });
  }

  console.log(`[ceo-scheduler] Processing ${tenants.length} tenants`);

  const results: Array<{
    tenant_id: string;
    tenant_name: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
    duration_ms: number;
  }> = [];

  for (const tenant of tenants) {
    const tenantStart = Date.now();

    try {
      const cacheKey = `ceo_daily_brief_${tenant.id}`;
      const { data: cached } = await supabase
        .from('agent_shared_state')
        .select('expires_at')
        .eq('key', cacheKey)
        .maybeSingle();

      if (cached?.expires_at && Date.now() < new Date(cached.expires_at).getTime()) {
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          status: 'skipped',
          duration_ms: Date.now() - tenantStart,
        });
        await logJobRun(supabase, tenant.id, 'daily_brief', 'skipped', null, Date.now() - tenantStart, { reason: 'cache_fresh' });
        continue;
      }

      const brief = await generateTenantBrief(supabase, tenant.id);
      results.push({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        status: 'success',
        duration_ms: Date.now() - tenantStart,
      });
      await logJobRun(supabase, tenant.id, 'daily_brief', 'success', null, Date.now() - tenantStart, {
        missed_calls: brief.missed_calls_24h,
        revenue_cents: brief.revenue_invoiced_this_month_cents,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        status: 'failed',
        error: errorMsg,
        duration_ms: Date.now() - tenantStart,
      });
      await logJobRun(supabase, tenant.id, 'daily_brief', 'failed', errorMsg, Date.now() - tenantStart);
    }
  }

  const duration = Date.now() - startTime;
  const summary = {
    total: tenants.length,
    success: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    duration_ms: duration,
    results,
  };

  console.log(`[ceo-scheduler] Completed: ${summary.success} success, ${summary.failed} failed, ${summary.skipped} skipped`);
  return jsonResponse(summary);
}

async function generateTenantBrief(supabase: SupabaseClient, tenantId: string): Promise<BriefData> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // ALL queries tenant-filtered
  const [
    leadsResult,
    clientsResult,
    decisionsResult,
    actionsResult,
    callLogsResult,
    invoicesResult,
    costs24hResult,
    costs30dResult,
    profileResult
  ] = await Promise.all([
    supabase.from('leads').select('id, lead_temperature, source').eq('tenant_id', tenantId).gte('created_at', yesterday.toISOString()),
    supabase.from('clients').select('mrr').eq('tenant_id', tenantId).eq('status', 'active'),
    supabase.from('ceo_decisions').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'pending'),
    supabase.from('ceo_action_queue').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'pending'),
    supabase.from('call_logs').select('id, status').eq('tenant_id', tenantId).gte('created_at', yesterday.toISOString()),
    supabase.from('client_invoices').select('amount_cents').eq('tenant_id', tenantId).eq('status', 'paid').gte('created_at', monthStart.toISOString()),
    supabase.from('agent_cost_tracking').select('cost_cents').eq('tenant_id', tenantId).gte('created_at', yesterday.toISOString()),
    supabase.from('agent_cost_tracking').select('cost_cents').eq('tenant_id', tenantId).gte('created_at', thirtyDaysAgo.toISOString()),
    supabase.from('business_profile').select('industry').eq('tenant_id', tenantId).maybeSingle(),
  ]);

  const leads = leadsResult.data || [];
  const clients = clientsResult.data || [];
  const callLogs = callLogsResult.data || [];
  const invoices = invoicesResult.data || [];
  const costs24h = costs24hResult.data || [];
  const costs30d = costs30dResult.data || [];
  const industry = profileResult.data?.industry || 'service';

  // Process data
  const leadTemperature: Record<string, number> = { hot: 0, warm: 0, cold: 0, unknown: 0 };
  const sourceCount: Record<string, number> = {};
  leads.forEach((lead: { lead_temperature?: string; source?: string }) => {
    const temp = (lead.lead_temperature || 'unknown').toLowerCase();
    leadTemperature[temp] = (leadTemperature[temp] || 0) + 1;
    const source = lead.source || 'direct';
    sourceCount[source] = (sourceCount[source] || 0) + 1;
  });

  const topSources = Object.entries(sourceCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([source, count]) => ({ source, count }));

  const mrrCents = clients.reduce((sum: number, c: { mrr?: number }) => sum + Math.round((c.mrr || 0) * 100), 0);
  const missedCalls = callLogs.filter((c: { status?: string }) => ['missed', 'no_answer', 'voicemail'].includes(c.status || '')).length;
  const revenueCents = invoices.reduce((sum: number, inv: { amount_cents?: number }) => sum + (inv.amount_cents || 0), 0);
  const aiCost24h = costs24h.reduce((sum: number, c: { cost_cents?: number }) => sum + (c.cost_cents || 0), 0);
  const totalCost30d = costs30d.reduce((sum: number, c: { cost_cents?: number }) => sum + (c.cost_cents || 0), 0);

  const briefData: BriefData = {
    leads_24h: leads.length,
    lead_temperature: leadTemperature,
    missed_calls_24h: missedCalls,
    total_calls_24h: callLogs.length,
    active_clients: clients.length,
    mrr_cents: mrrCents,
    revenue_invoiced_this_month_cents: revenueCents,
    ai_cost_24h_cents: aiCost24h,
    ai_cost_30d_avg_cents: Math.round(totalCost30d / 30),
    top_lead_sources: topSources,
    pending_actions: (actionsResult.count || 0) + (decisionsResult.count || 0),
  };

  // Generate AI brief
  const prompt = `You are the AI Chief of Staff for a ${industry} business. Generate a crisp executive daily brief.

DATA:
- New leads (24h): ${briefData.leads_24h}
- Lead temp: Hot=${leadTemperature.hot}, Warm=${leadTemperature.warm}, Cold=${leadTemperature.cold}
- Calls: ${briefData.total_calls_24h} total, ${missedCalls} missed
- Active clients: ${briefData.active_clients} (MRR: $${(mrrCents / 100).toFixed(2)})
- Revenue this month: $${(revenueCents / 100).toFixed(2)}
- AI costs (24h): $${(aiCost24h / 100).toFixed(2)}
- Pending actions: ${briefData.pending_actions}

Respond ONLY as JSON: {"bullets": [...], "risk_alert": "...", "opportunity": "..."}`;

  const aiResponse: AIChatResponse = await aiChat({
    messages: [{ role: 'user', content: prompt }],
    purpose: 'ceo_daily_brief',
    max_tokens: 800,
  });

  let briefContent: { bullets: string[]; risk_alert: string | null; opportunity: string | null };
  try {
    let text = aiResponse.text.trim();
    if (text.startsWith('```')) text = text.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    briefContent = JSON.parse(text);
  } catch {
    briefContent = {
      bullets: [`${leads.length} new leads`, `${clients.length} active clients`, `${missedCalls} missed calls`],
      risk_alert: missedCalls > 5 ? `${missedCalls} missed calls` : null,
      opportunity: leadTemperature.hot > 0 ? `${leadTemperature.hot} hot leads` : null,
    };
  }

  // Cache brief
  const cacheKey = `ceo_daily_brief_${tenantId}`;
  await supabase.from('agent_shared_state').upsert({
    key: cacheKey,
    value: { generated_at: now.toISOString(), tenant_id: tenantId, ...briefContent, data_snapshot: briefData },
    category: 'ceo_brief',
    expires_at: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
  }, { onConflict: 'key' });

  // Track cost WITH tenant_id
  const tokensUsed = aiResponse.usage?.total_tokens || 0;
  const costCents = estimateCostCents(aiResponse.provider, aiResponse.model, aiResponse.usage);
  await supabase.from('agent_cost_tracking').insert({
    agent_type: 'ceo-scheduler',
    purpose: 'ceo_daily_brief',
    model: aiResponse.model,
    provider: aiResponse.provider,
    api_calls: 1,
    tokens_used: tokensUsed,
    cost_cents: costCents,
    tenant_id: tenantId,
  });

  return briefData;
}

async function runCostRollup(supabase: SupabaseClient): Promise<Response> {
  const startTime = Date.now();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data: costs, error } = await supabase
    .from('agent_cost_tracking')
    .select('tenant_id, agent_type, cost_cents, tokens_used')
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  // Group by tenant
  const byTenant: Record<string, { total_cents: number; total_tokens: number; by_agent: Record<string, number> }> = {};

  for (const c of costs || []) {
    const tid = c.tenant_id || 'unassigned';
    if (!byTenant[tid]) {
      byTenant[tid] = { total_cents: 0, total_tokens: 0, by_agent: {} };
    }
    byTenant[tid].total_cents += c.cost_cents || 0;
    byTenant[tid].total_tokens += c.tokens_used || 0;
    const agent = c.agent_type || 'unknown';
    byTenant[tid].by_agent[agent] = (byTenant[tid].by_agent[agent] || 0) + (c.cost_cents || 0);
  }

  // Cache per tenant
  for (const [tid, rollup] of Object.entries(byTenant)) {
    const cacheKey = tid === 'unassigned' ? 'ceo_cost_rollup_unassigned' : `ceo_cost_rollup_${tid}`;
    await supabase.from('agent_shared_state').upsert({
      key: cacheKey,
      value: rollup,
      category: 'ceo_cost',
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'key' });
  }

  const duration = Date.now() - startTime;
  await logJobRun(supabase, null, 'cost_rollup', 'success', null, duration, { tenants: Object.keys(byTenant).length });

  return jsonResponse({ success: true, duration_ms: duration, tenants_processed: Object.keys(byTenant).length });
}

async function checkJobStatus(supabase: SupabaseClient): Promise<Response> {
  const { data: jobs, error } = await supabase
    .from('ceo_job_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return jsonResponse({ error: error.message }, 500);

  const summary: Record<string, { total: number; success: number; failed: number; skipped: number }> = {};
  for (const job of jobs || []) {
    const jt = job.job_type;
    if (!summary[jt]) summary[jt] = { total: 0, success: 0, failed: 0, skipped: 0 };
    summary[jt].total++;
    if (job.status === 'success') summary[jt].success++;
    else if (job.status === 'failed') summary[jt].failed++;
    else if (job.status === 'skipped') summary[jt].skipped++;
  }

  return jsonResponse({ summary, recent_jobs: jobs?.slice(0, 10) });
}

async function logJobRun(
  supabase: SupabaseClient,
  tenantId: string | null,
  jobType: string,
  status: string,
  error: string | null,
  durationMs: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('ceo_job_runs').insert({
      tenant_id: tenantId,
      job_type: jobType,
      status,
      error,
      duration_ms: durationMs,
      metadata,
    });
  } catch (e) {
    console.error('[ceo-scheduler] Failed to log job run:', e);
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
