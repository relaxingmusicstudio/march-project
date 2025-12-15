import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BusinessContextRequest {
  action: 'get_current_mode' | 'set_mode' | 'check_context' | 'get_roe' | 'update_roe' | 'get_business_hours';
  mode?: string;
  reason?: string;
  duration_hours?: number;
  rule_id?: string;
  rule_data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, mode, reason, duration_hours, rule_id, rule_data }: BusinessContextRequest = await req.json();

    console.log(`[business-context] Action: ${action}`);

    switch (action) {
      case 'get_current_mode': {
        const { data: config } = await supabase
          .from('system_config')
          .select('config_value')
          .eq('config_key', 'current_mode')
          .single();

        // Also get recent mode history
        const { data: history } = await supabase
          .from('system_modes')
          .select('*')
          .order('activated_at', { ascending: false })
          .limit(5);

        // Check for any active business context that should override
        const now = new Date().toISOString();
        const { data: activeContext } = await supabase
          .from('business_context')
          .select('*')
          .lte('start_time', now)
          .gte('end_time', now)
          .not('auto_mode', 'is', null)
          .order('start_time', { ascending: false })
          .limit(1);

        const currentMode = config?.config_value?.mode || 'growth';
        const overrideMode = activeContext?.[0]?.auto_mode;

        return new Response(JSON.stringify({
          current_mode: overrideMode || currentMode,
          base_mode: currentMode,
          override_active: !!overrideMode,
          override_context: activeContext?.[0] || null,
          mode_history: history || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'set_mode': {
        if (!mode) {
          throw new Error('Mode is required');
        }

        // Get current mode
        const { data: currentConfig } = await supabase
          .from('system_config')
          .select('config_value')
          .eq('config_key', 'current_mode')
          .single();

        const previousMode = currentConfig?.config_value?.mode || 'growth';

        // Calculate auto-revert time if duration specified
        let autoRevertAt = null;
        if (duration_hours) {
          autoRevertAt = new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString();
        }

        // Insert mode change record
        const { error: historyError } = await supabase
          .from('system_modes')
          .insert({
            mode,
            previous_mode: previousMode,
            activated_by: 'user',
            reason: reason || `Manual switch to ${mode} mode`,
            auto_revert_at: autoRevertAt
          });

        if (historyError) throw historyError;

        // Update current mode config
        const { error: updateError } = await supabase
          .from('system_config')
          .update({
            config_value: { mode, since: new Date().toISOString() }
          })
          .eq('config_key', 'current_mode');

        if (updateError) throw updateError;

        // Create notification for mode change
        await supabase.from('notification_queue').insert({
          title: `System Mode Changed to ${mode.toUpperCase()}`,
          body: reason || `AI system is now in ${mode} mode`,
          priority: mode === 'emergency' ? 'critical' : 'important',
          channels: ['push', 'in_app'],
          data: { mode, previous_mode: previousMode }
        });

        console.log(`[business-context] Mode changed: ${previousMode} → ${mode}`);

        return new Response(JSON.stringify({
          success: true,
          previous_mode: previousMode,
          new_mode: mode,
          auto_revert_at: autoRevertAt
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'check_context': {
        // Check current time against business hours and calendar blocks
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        // Get business hours config
        const { data: hoursConfig } = await supabase
          .from('system_config')
          .select('config_value')
          .eq('config_key', 'business_hours')
          .single();

        const businessHours = hoursConfig?.config_value || {
          start: '09:00',
          end: '18:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        };

        const startHour = parseInt(businessHours.start.split(':')[0]);
        const endHour = parseInt(businessHours.end.split(':')[0]);
        const isBusinessDay = businessHours.days.includes(currentDay);
        const isBusinessHours = isBusinessDay && currentHour >= startHour && currentHour < endHour;

        // Check for active calendar blocks
        const nowISO = now.toISOString();
        const { data: activeBlocks } = await supabase
          .from('business_context')
          .select('*')
          .lte('start_time', nowISO)
          .gte('end_time', nowISO);

        // Get applicable ROE rules
        const { data: activeRules } = await supabase
          .from('rules_of_engagement')
          .select('*')
          .eq('is_active', true)
          .order('priority', { ascending: true });

        // Evaluate time restrictions
        const blockedByTimeRule = activeRules?.find(rule => {
          if (rule.rule_type !== 'time_restriction') return false;
          const conditions = rule.conditions as Record<string, unknown>;
          
          if (conditions.before_hour && currentHour < (conditions.before_hour as number)) return true;
          if (conditions.after_hour && currentHour >= (conditions.after_hour as number)) return true;
          if (conditions.days && (conditions.days as string[]).includes(currentDay)) return true;
          
          return false;
        });

        return new Response(JSON.stringify({
          is_business_hours: isBusinessHours,
          current_hour: currentHour,
          current_day: currentDay,
          business_hours_config: businessHours,
          active_calendar_blocks: activeBlocks || [],
          blocking_rule: blockedByTimeRule || null,
          can_outreach: isBusinessHours && !blockedByTimeRule && activeBlocks?.length === 0,
          recommendations: !isBusinessHours 
            ? ['Queue outreach for next business day']
            : blockedByTimeRule 
              ? [`Blocked by rule: ${blockedByTimeRule.rule_name}`]
              : ['Clear to proceed with outreach']
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_roe': {
        const { data: rules } = await supabase
          .from('rules_of_engagement')
          .select('*')
          .order('priority', { ascending: true });

        return new Response(JSON.stringify({ rules: rules || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update_roe': {
        if (!rule_id || !rule_data) {
          throw new Error('rule_id and rule_data are required');
        }

        const { error } = await supabase
          .from('rules_of_engagement')
          .update(rule_data)
          .eq('id', rule_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_business_hours': {
        const { data: config } = await supabase
          .from('system_config')
          .select('config_value')
          .eq('config_key', 'business_hours')
          .single();

        return new Response(JSON.stringify({
          business_hours: config?.config_value || {
            start: '09:00',
            end: '18:00',
            timezone: 'America/New_York',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('[business-context] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
