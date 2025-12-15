import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditLogEntry {
  agent_name?: string;
  action_type: string;
  entity_type?: string;
  entity_id?: string;
  description?: string;
  request_snapshot?: Record<string, unknown>;
  response_snapshot?: Record<string, unknown>;
  duration_ms?: number;
  success?: boolean;
  error_message?: string;
  user_id?: string;
  tenant_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestBody = await req.json();
    const { action, entries } = requestBody;

    // Get IP address from request headers
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('x-real-ip') || 
                      'unknown';

    if (action === 'log') {
      // Single log entry
      const entry: AuditLogEntry = entries || requestBody;
      
      const { error } = await supabase
        .from('platform_audit_log')
        .insert({
          ...entry,
          ip_address: ipAddress,
          timestamp: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to log audit entry:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'batch_log') {
      // Multiple log entries
      const logEntries = (entries as AuditLogEntry[]).map(entry => ({
        ...entry,
        ip_address: ipAddress,
        timestamp: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('platform_audit_log')
        .insert(logEntries);

      if (error) {
        console.error('Failed to batch log audit entries:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, count: logEntries.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'query') {
      // Query audit logs with filters
      const { 
        start_date, 
        end_date, 
        agent_name, 
        action_type, 
        entity_type,
        limit = 100,
        offset = 0 
      } = entries || {};

      let query = supabase
        .from('platform_audit_log')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (start_date) {
        query = query.gte('timestamp', start_date);
      }
      if (end_date) {
        query = query.lte('timestamp', end_date);
      }
      if (agent_name) {
        query = query.eq('agent_name', agent_name);
      }
      if (action_type) {
        query = query.eq('action_type', action_type);
      }
      if (entity_type) {
        query = query.eq('entity_type', entity_type);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Failed to query audit logs:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ logs: data, total: count }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_stats') {
      // Get audit statistics
      const { days = 7 } = entries || {};
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: logs, error } = await supabase
        .from('platform_audit_log')
        .select('agent_name, action_type, success, timestamp')
        .gte('timestamp', startDate.toISOString());

      if (error) {
        console.error('Failed to get audit stats:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Calculate statistics
      const stats = {
        total_actions: logs?.length || 0,
        successful_actions: logs?.filter((l: { success?: boolean }) => l.success !== false).length || 0,
        failed_actions: logs?.filter((l: { success?: boolean }) => l.success === false).length || 0,
        by_agent: {} as Record<string, number>,
        by_action_type: {} as Record<string, number>,
        daily_breakdown: {} as Record<string, number>,
      };

      logs?.forEach((log: { agent_name?: string; action_type: string; timestamp: string }) => {
        // By agent
        const agent = log.agent_name || 'unknown';
        stats.by_agent[agent] = (stats.by_agent[agent] || 0) + 1;

        // By action type
        stats.by_action_type[log.action_type] = (stats.by_action_type[log.action_type] || 0) + 1;

        // Daily breakdown
        const day = log.timestamp.split('T')[0];
        stats.daily_breakdown[day] = (stats.daily_breakdown[day] || 0) + 1;
      });

      return new Response(JSON.stringify(stats), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Audit logger error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
