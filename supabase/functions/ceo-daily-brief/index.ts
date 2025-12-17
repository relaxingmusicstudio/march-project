import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChat, estimateCostCents, AIChatResponse } from "../_shared/ai.ts";

/**
 * CEO Daily Brief Generator
 * 
 * SECURITY: Requires valid user JWT with tenant_id. Returns 401 if tenant cannot be resolved.
 * No "global mode" - every brief is tenant-scoped.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants
const RATE_LIMIT_ACTION = 'brief_refresh';
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
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

interface DailyBrief {
  generated_at: string;
  tenant_id: string;
  bullets: string[];
  risk_alert: string | null;
  opportunity: string | null;
  data_snapshot: BriefData;
}

/**
 * Get tenant_id from JWT via anon client with user's auth token.
 * Returns null if auth fails or tenant not found.
 */
async function getTenantIdFromAuth(authHeader: string | null): Promise<string | null> {
  if (!authHeader) {
    console.log('[ceo-daily-brief] No authorization header');
    return null;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const token = authHeader.replace('Bearer ', '');

  // Create user-context client with the user's JWT
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  try {
    const { data, error } = await userClient.rpc('get_user_tenant_id');
    if (error) {
      console.error('[ceo-daily-brief] RPC get_user_tenant_id failed:', error.message);
      return null;
    }
    if (!data) {
      console.log('[ceo-daily-brief] User has no tenant_id');
      return null;
    }
    return data as string;
  } catch (e) {
    console.error('[ceo-daily-brief] Auth tenant lookup error:', e);
    return null;
  }
}

/**
 * Check rate limit using count query (not pulling arrays)
 */
async function checkRateLimit(supabase: SupabaseClient, tenantId: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { count, error } = await supabase
    .from('ceo_rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('action_type', RATE_LIMIT_ACTION)
    .gte('created_at', windowStart);

  if (error) {
    console.error('[ceo-daily-brief] Rate limit check failed:', error.message);
    // Fail open but log
    return { allowed: true, remaining: RATE_LIMIT_MAX };
  }

  const currentCount = count || 0;
  if (currentCount >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: RATE_LIMIT_MAX - currentCount };
}

/**
 * Record rate limit usage
 */
async function recordRateLimitUsage(supabase: SupabaseClient, tenantId: string): Promise<void> {
  await supabase.from('ceo_rate_limits').insert({
    tenant_id: tenantId,
    action_type: RATE_LIMIT_ACTION,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    
    // SECURITY: Require valid tenant_id from JWT
    const tenantId = await getTenantIdFromAuth(authHeader);
    if (!tenantId) {
      return jsonResponse({ 
        error: 'Unauthorized', 
        message: 'Valid authentication with tenant association required' 
      }, 401);
    }

    console.log(`[ceo-daily-brief] Request for tenant=${tenantId}`);

    // Service role client for tenant-filtered reads
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { force_refresh = false } = await req.json().catch(() => ({}));
    const cacheKey = `ceo_daily_brief_${tenantId}`;

    // Rate limiting on force refresh
    if (force_refresh) {
      const rateCheck = await checkRateLimit(supabase, tenantId);
      if (!rateCheck.allowed) {
        console.log(`[ceo-daily-brief] Rate limit exceeded for tenant=${tenantId}`);
        return jsonResponse({
          error: 'Rate limit exceeded',
          message: `Maximum ${RATE_LIMIT_MAX} refreshes per hour`,
          rate_limit: { max: RATE_LIMIT_MAX, remaining: 0, window_hours: 1 }
        }, 429);
      }
      await recordRateLimitUsage(supabase, tenantId);
      console.log(`[ceo-daily-brief] Rate limit OK. Remaining: ${rateCheck.remaining - 1}`);
    }

    // Check cache (TTL based on expires_at)
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from('agent_shared_state')
        .select('value, updated_at, expires_at')
        .eq('key', cacheKey)
        .maybeSingle();

      if (cached?.expires_at) {
        const expiresAt = new Date(cached.expires_at).getTime();
        if (Date.now() < expiresAt) {
          const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
          console.log(`[ceo-daily-brief] Returning cached brief (age=${Math.round(cacheAge / 3600000)}h)`);
          return jsonResponse({ ...cached.value, from_cache: true, cache_age_hours: Math.round(cacheAge / 3600000 * 10) / 10 });
        }
      }
    }

    // Aggregate data with tenant filtering
    const briefData = await aggregateTenantData(supabase, tenantId);
    const industry = await getBusinessIndustry(supabase, tenantId);

    // Generate AI brief
    const aiResponse = await generateAIBrief(briefData, industry);

    let briefContent: { bullets: string[]; risk_alert: string | null; opportunity: string | null };
    try {
      let text = aiResponse.text.trim();
      if (text.startsWith('```')) {
        text = text.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }
      briefContent = JSON.parse(text);
    } catch {
      briefContent = createFallbackBrief(briefData);
    }

    const now = new Date();
    const dailyBrief: DailyBrief = {
      generated_at: now.toISOString(),
      tenant_id: tenantId,
      bullets: briefContent.bullets,
      risk_alert: briefContent.risk_alert,
      opportunity: briefContent.opportunity,
      data_snapshot: briefData,
    };

    // Cache the brief with TTL
    await supabase.from('agent_shared_state').upsert({
      key: cacheKey,
      value: dailyBrief,
      category: 'ceo_brief',
      expires_at: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
    }, { onConflict: 'key' });

    // Log cost with tenant_id
    const tokensUsed = aiResponse.usage?.total_tokens || 0;
    const costCents = estimateCostCents(aiResponse.provider, aiResponse.model, aiResponse.usage);

    await supabase.from('agent_cost_tracking').insert({
      agent_type: 'ceo-daily-brief',
      purpose: 'ceo_daily_brief',
      model: aiResponse.model,
      provider: aiResponse.provider,
      api_calls: 1,
      tokens_used: tokensUsed,
      cost_cents: costCents,
      avg_latency_ms: aiResponse.latency_ms || null,
      tenant_id: tenantId,
    });

    console.log(`[ceo-daily-brief] Brief generated. tokens=${tokensUsed} cost_cents=${costCents}`);
    return jsonResponse(dailyBrief);

  } catch (error) {
    console.error('[ceo-daily-brief] Error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

async function aggregateTenantData(supabase: SupabaseClient, tenantId: string): Promise<BriefData> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Execute all queries in parallel - ALL tenant filtered
  const [
    leadsResult,
    clientsResult,
    decisionsResult,
    actionsResult,
    callLogsResult,
    invoicesResult,
    costs24hResult,
    costs30dResult
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('id, lead_temperature, source')
      .eq('tenant_id', tenantId)
      .gte('created_at', yesterday.toISOString()),
    supabase
      .from('clients')
      .select('mrr')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    supabase
      .from('ceo_decisions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
    supabase
      .from('ceo_action_queue')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
    supabase
      .from('call_logs')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .gte('created_at', yesterday.toISOString()),
    supabase
      .from('client_invoices')
      .select('amount_cents')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('agent_cost_tracking')
      .select('cost_cents')
      .eq('tenant_id', tenantId)
      .gte('created_at', yesterday.toISOString()),
    supabase
      .from('agent_cost_tracking')
      .select('cost_cents')
      .eq('tenant_id', tenantId)
      .gte('created_at', thirtyDaysAgo.toISOString()),
  ]);

  const leads = leadsResult.data || [];
  const clients = clientsResult.data || [];
  const callLogs = callLogsResult.data || [];
  const invoices = invoicesResult.data || [];
  const costs24h = costs24hResult.data || [];
  const costs30d = costs30dResult.data || [];

  // Process lead temperatures and sources
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

  // MRR: dollars * 100 = cents
  const mrrCents = clients.reduce(
    (sum: number, c: { mrr?: number }) => sum + Math.round((c.mrr || 0) * 100),
    0
  );

  // Missed calls
  const missedCalls = callLogs.filter((c: { status?: string }) =>
    ['missed', 'no_answer', 'voicemail'].includes(c.status || '')
  ).length;

  // Revenue invoiced
  const revenueInvoicedCents = invoices.reduce(
    (sum: number, inv: { amount_cents?: number }) => sum + (inv.amount_cents || 0),
    0
  );

  // AI costs
  const aiCost24h = costs24h.reduce((sum: number, c: { cost_cents?: number }) => sum + (c.cost_cents || 0), 0);
  const totalCost30d = costs30d.reduce((sum: number, c: { cost_cents?: number }) => sum + (c.cost_cents || 0), 0);
  const aiCost30dAvg = Math.round(totalCost30d / 30);

  return {
    leads_24h: leads.length,
    lead_temperature: leadTemperature,
    missed_calls_24h: missedCalls,
    total_calls_24h: callLogs.length,
    active_clients: clients.length,
    mrr_cents: mrrCents,
    revenue_invoiced_this_month_cents: revenueInvoicedCents,
    ai_cost_24h_cents: aiCost24h,
    ai_cost_30d_avg_cents: aiCost30dAvg,
    top_lead_sources: topSources,
    pending_actions: (actionsResult.count || 0) + (decisionsResult.count || 0),
  };
}

async function getBusinessIndustry(supabase: SupabaseClient, tenantId: string): Promise<string> {
  const { data } = await supabase
    .from('business_profile')
    .select('industry')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return data?.industry || 'service';
}

async function generateAIBrief(briefData: BriefData, industry: string): Promise<AIChatResponse> {
  const prompt = `You are the AI Chief of Staff for a ${industry} business. Generate a crisp executive daily brief.

DATA (last 24 hours unless noted):
- New leads: ${briefData.leads_24h}
- Lead temperature: Hot=${briefData.lead_temperature.hot}, Warm=${briefData.lead_temperature.warm}, Cold=${briefData.lead_temperature.cold}
- Total calls: ${briefData.total_calls_24h}
- Missed calls: ${briefData.missed_calls_24h}
- Active clients: ${briefData.active_clients}
- MRR: $${(briefData.mrr_cents / 100).toFixed(2)}
- Invoiced this month: $${(briefData.revenue_invoiced_this_month_cents / 100).toFixed(2)}
- AI costs (24h): $${(briefData.ai_cost_24h_cents / 100).toFixed(2)}
- AI costs (30d avg/day): $${(briefData.ai_cost_30d_avg_cents / 100).toFixed(2)}
- Top lead sources: ${briefData.top_lead_sources.map(s => `${s.source}(${s.count})`).join(', ') || 'none'}
- Pending actions: ${briefData.pending_actions}

RULES:
1. Provide 5-7 bullet points summarizing business health
2. Include exactly 1 risk alert (or "None" if no concerns)
3. Include exactly 1 opportunity recommendation
4. Be specific with numbers
5. Focus on actionable insights

Respond ONLY as JSON: {"bullets": [...], "risk_alert": "...", "opportunity": "..."}`;

  return await aiChat({
    messages: [{ role: 'user', content: prompt }],
    purpose: 'ceo_daily_brief',
    max_tokens: 800,
  });
}

function createFallbackBrief(briefData: BriefData): { bullets: string[]; risk_alert: string | null; opportunity: string | null } {
  return {
    bullets: [
      `${briefData.leads_24h} new leads in last 24h`,
      `${briefData.active_clients} active clients (MRR: $${(briefData.mrr_cents / 100).toFixed(2)})`,
      `${briefData.missed_calls_24h} missed calls out of ${briefData.total_calls_24h} total`,
      `Revenue invoiced this month: $${(briefData.revenue_invoiced_this_month_cents / 100).toFixed(2)}`,
      `${briefData.pending_actions} pending actions`,
    ],
    risk_alert: briefData.missed_calls_24h > 5 ? `${briefData.missed_calls_24h} missed calls - potential revenue leakage` : null,
    opportunity: briefData.lead_temperature.hot > 0 ? `${briefData.lead_temperature.hot} hot leads ready for follow-up` : null,
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
