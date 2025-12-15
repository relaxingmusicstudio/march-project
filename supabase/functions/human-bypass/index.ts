import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BypassRequest {
  action: 'trigger' | 'get_pending' | 'resolve' | 'assign';
  request_id?: string;
  contact_id?: string;
  lead_id?: string;
  channel?: string;
  keyword?: string;
  message?: string;
  assigned_to?: string;
  resolution_notes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      action, 
      request_id, 
      contact_id, 
      lead_id, 
      channel, 
      keyword, 
      message,
      assigned_to,
      resolution_notes 
    }: BypassRequest = await req.json();

    console.log(`[human-bypass] Action: ${action}`);

    switch (action) {
      case 'trigger': {
        if (!channel || !keyword) {
          throw new Error('channel and keyword are required');
        }

        // Create bypass request
        const { data: request, error } = await supabase
          .from('human_bypass_requests')
          .insert({
            contact_id,
            lead_id,
            channel,
            trigger_keyword: keyword,
            original_message: message,
            status: 'pending'
          })
          .select()
          .single();

        if (error) throw error;

        // Pause AI on this conversation
        if (contact_id) {
          // Mark conversation as requiring human
          await supabase
            .from('conversations_unified')
            .update({ 
              status: 'human_required',
              assigned_to: null // Clear any AI assignment
            })
            .eq('contact_id', contact_id);
        }

        // Send critical notification
        await supabase.functions.invoke('push-notifications', {
          body: {
            action: 'send',
            title: '🚨 Human Requested',
            body: `A contact replied "${keyword}" - AI paused on this thread`,
            priority: 'critical',
            data: {
              bypass_request_id: request.id,
              contact_id,
              lead_id,
              channel
            }
          }
        });

        // Log to automation
        await supabase.from('automation_logs').insert({
          function_name: 'human-bypass',
          status: 'completed',
          metadata: {
            action: 'trigger',
            request_id: request.id,
            channel,
            keyword
          }
        });

        return new Response(JSON.stringify({
          success: true,
          request_id: request.id,
          message: 'Human bypass triggered. AI paused on this conversation.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_pending': {
        const { data: requests } = await supabase
          .from('human_bypass_requests')
          .select(`
            *,
            contact:contacts_unified(name, email, phone),
            lead:leads(name, company, phone)
          `)
          .in('status', ['pending', 'assigned'])
          .order('created_at', { ascending: true });

        return new Response(JSON.stringify({
          pending_requests: requests || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'assign': {
        if (!request_id || !assigned_to) {
          throw new Error('request_id and assigned_to are required');
        }

        const { error } = await supabase
          .from('human_bypass_requests')
          .update({
            status: 'assigned',
            assigned_to
          })
          .eq('id', request_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'resolve': {
        if (!request_id) {
          throw new Error('request_id is required');
        }

        const { error } = await supabase
          .from('human_bypass_requests')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_notes: resolution_notes || 'Resolved by team'
          })
          .eq('id', request_id);

        if (error) throw error;

        // Re-enable AI on the conversation
        const { data: request } = await supabase
          .from('human_bypass_requests')
          .select('contact_id')
          .eq('id', request_id)
          .single();

        if (request?.contact_id) {
          await supabase
            .from('conversations_unified')
            .update({ status: 'active' })
            .eq('contact_id', request.contact_id);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('[human-bypass] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
