import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthMetric {
  name: string;
  value: number;
  unit: string;
  thresholdWarning: number;
  thresholdCritical: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action } = await req.json();

    if (action === 'collect') {
      // Collect various health metrics
      const metrics: HealthMetric[] = [];

      // Database response time (simulated - would use actual query timing)
      const dbStart = Date.now();
      await supabase.from('analytics_events').select('id').limit(1);
      const dbTime = Date.now() - dbStart;
      metrics.push({
        name: 'database_response_ms',
        value: dbTime,
        unit: 'ms',
        thresholdWarning: 100,
        thresholdCritical: 500
      });

      // Count active leads (business metric)
      const { count: leadCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');
      metrics.push({
        name: 'active_leads',
        value: leadCount || 0,
        unit: 'count',
        thresholdWarning: 5,
        thresholdCritical: 0
      });

      // Count active clients
      const { count: clientCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      metrics.push({
        name: 'active_clients',
        value: clientCount || 0,
        unit: 'count',
        thresholdWarning: 1,
        thresholdCritical: 0
      });

      // API error rate (from last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: errorCount } = await supabase
        .from('api_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo)
        .gte('response_status', 400);
      const { count: totalCalls } = await supabase
        .from('api_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo);
      const errorRate = totalCalls && totalCalls > 0 ? ((errorCount || 0) / totalCalls) * 100 : 0;
      metrics.push({
        name: 'api_error_rate',
        value: Math.round(errorRate * 100) / 100,
        unit: 'percent',
        thresholdWarning: 5,
        thresholdCritical: 15
      });

      // Agent memory cache hit rate
      const { data: perfData } = await supabase
        .from('agent_performance')
        .select('cache_hits, total_queries')
        .order('date', { ascending: false })
        .limit(7);
      const totalQueries = perfData?.reduce((sum, p) => sum + (p.total_queries || 0), 0) || 0;
      const cacheHits = perfData?.reduce((sum, p) => sum + (p.cache_hits || 0), 0) || 0;
      const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;
      metrics.push({
        name: 'cache_hit_rate',
        value: Math.round(cacheHitRate * 100) / 100,
        unit: 'percent',
        thresholdWarning: 20,
        thresholdCritical: 10
      });

      // Save metrics to database
      for (const metric of metrics) {
        const status = 
          metric.value >= metric.thresholdCritical && metric.name !== 'active_leads' && metric.name !== 'active_clients' && metric.name !== 'cache_hit_rate'
            ? 'critical'
            : metric.value >= metric.thresholdWarning && metric.name !== 'active_leads' && metric.name !== 'active_clients' && metric.name !== 'cache_hit_rate'
              ? 'warning'
              : 'healthy';

        await supabase.from('system_health').insert({
          metric_name: metric.name,
          metric_value: metric.value,
          metric_unit: metric.unit,
          status,
          threshold_warning: metric.thresholdWarning,
          threshold_critical: metric.thresholdCritical
        });
      }

      console.log(`Collected ${metrics.length} health metrics`);

      return new Response(JSON.stringify({ 
        success: true, 
        metrics,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_status') {
      // Get latest metrics for each type
      const { data: latestMetrics } = await supabase
        .from('system_health')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(50);

      // Deduplicate to get latest for each metric
      const latestByName = new Map();
      for (const m of latestMetrics || []) {
        if (!latestByName.has(m.metric_name)) {
          latestByName.set(m.metric_name, m);
        }
      }

      const metrics = Array.from(latestByName.values());
      const criticalCount = metrics.filter(m => m.status === 'critical').length;
      const warningCount = metrics.filter(m => m.status === 'warning').length;

      const overallStatus = criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'healthy';

      return new Response(JSON.stringify({ 
        success: true,
        overallStatus,
        criticalCount,
        warningCount,
        metrics
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('system-health error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
