import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CommandResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// Parse SMS/Voice commands
function parseCommand(input: string): { command: string; args: string[] } {
  const normalized = input.trim().toUpperCase();
  const parts = normalized.split(/\s+/);
  return {
    command: parts[0] || '',
    args: parts.slice(1)
  };
}

// Format number for display
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message, from_number, channel } = await req.json();

    console.log(`[mobile-command] Received from ${from_number} via ${channel}: ${message}`);

    const { command, args } = parseCommand(message);
    let result: CommandResult;

    switch (command) {
      case 'STATUS': {
        // Get today's stats
        const today = new Date().toISOString().split('T')[0];
        
        const [leadsResult, clientsResult, dealsResult] = await Promise.all([
          supabase.from('leads').select('id', { count: 'exact' }).gte('created_at', today),
          supabase.from('clients').select('mrr').eq('status', 'active'),
          supabase.from('deal_pipeline').select('value, stage').not('stage', 'eq', 'closed_lost')
        ]);

        const totalMRR = clientsResult.data?.reduce((sum, c) => sum + (c.mrr || 0), 0) || 0;
        const pipelineValue = dealsResult.data?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
        const hotLeads = dealsResult.data?.filter(d => d.stage === 'proposal' || d.stage === 'negotiation').length || 0;

        result = {
          success: true,
          message: `📊 TODAY'S STATUS\n` +
            `• New Leads: ${leadsResult.count || 0}\n` +
            `• Active MRR: ${formatCurrency(totalMRR)}\n` +
            `• Pipeline: ${formatCurrency(pipelineValue)}\n` +
            `• Hot Leads: ${hotLeads}`,
          data: {
            new_leads_today: leadsResult.count,
            active_mrr: totalMRR,
            pipeline_value: pipelineValue,
            hot_leads: hotLeads
          }
        };
        break;
      }

      case 'PAUSE': {
        // Parse duration (e.g., "PAUSE AI 2H" or "PAUSE 30M")
        const durationArg = args.find(a => /^\d+[HM]$/.test(a)) || '1H';
        const unit = durationArg.slice(-1);
        const amount = parseInt(durationArg.slice(0, -1));
        const hours = unit === 'H' ? amount : amount / 60;

        // Set maintenance mode
        await supabase.functions.invoke('business-context', {
          body: {
            action: 'set_mode',
            mode: 'maintenance',
            reason: `Paused via SMS command from ${from_number}`,
            duration_hours: hours
          }
        });

        result = {
          success: true,
          message: `⏸️ AI PAUSED for ${amount}${unit === 'H' ? ' hours' : ' minutes'}.\n` +
            `Outreach stopped. Reply RESUME to reactivate.`,
          data: { paused_for_hours: hours }
        };
        break;
      }

      case 'RESUME': {
        await supabase.functions.invoke('business-context', {
          body: {
            action: 'set_mode',
            mode: 'growth',
            reason: `Resumed via SMS command from ${from_number}`
          }
        });

        result = {
          success: true,
          message: `▶️ AI RESUMED\nGrowth mode activated. All systems go.`
        };
        break;
      }

      case 'GROWTH':
      case 'MAINTENANCE':
      case 'VACATION': {
        const mode = command.toLowerCase();
        await supabase.functions.invoke('business-context', {
          body: {
            action: 'set_mode',
            mode,
            reason: `Set via SMS command from ${from_number}`
          }
        });

        const modeDescriptions: Record<string, string> = {
          growth: '🚀 GROWTH MODE\nAggressive lead gen & outreach active.',
          maintenance: '🔧 MAINTENANCE MODE\nFocusing on existing clients only.',
          vacation: '🏖️ VACATION MODE\nAI in read-only. Critical alerts only.'
        };

        result = {
          success: true,
          message: modeDescriptions[mode]
        };
        break;
      }

      case 'LEADS': {
        const { data: hotLeads } = await supabase
          .from('leads')
          .select('name, company, score')
          .gte('score', 70)
          .order('score', { ascending: false })
          .limit(5);

        const leadsList = hotLeads?.map((l, i) => 
          `${i + 1}. ${l.name} (${l.company || 'No Co'}) - Score: ${l.score}`
        ).join('\n') || 'No hot leads right now.';

        result = {
          success: true,
          message: `🔥 TOP HOT LEADS\n${leadsList}`,
          data: { leads: hotLeads }
        };
        break;
      }

      case 'CALL': {
        const leadName = args.join(' ');
        if (!leadName) {
          result = {
            success: false,
            message: '❌ Usage: CALL [Lead Name]'
          };
          break;
        }

        const { data: leads } = await supabase
          .from('leads')
          .select('id, name, phone, company')
          .ilike('name', `%${leadName}%`)
          .limit(1);

        if (!leads || leads.length === 0) {
          result = {
            success: false,
            message: `❌ No lead found matching "${leadName}"`
          };
          break;
        }

        const lead = leads[0];
        if (!lead.phone) {
          result = {
            success: false,
            message: `❌ ${lead.name} has no phone number on file.`
          };
          break;
        }

        // Add to dialer queue with high priority
        await supabase.from('dialer_queue').insert({
          lead_id: lead.id,
          phone_number: lead.phone,
          priority: 1,
          notes: `Callback requested via SMS from ${from_number}`,
          requires_human: true
        });

        result = {
          success: true,
          message: `📞 CALLBACK QUEUED\n${lead.name} (${lead.company || 'No Co'})\n${lead.phone}\nCall scheduled next.`,
          data: { lead_id: lead.id, phone: lead.phone }
        };
        break;
      }

      case 'HUMAN':
      case 'STOP': {
        // Create a human bypass request
        await supabase.from('human_bypass_requests').insert({
          channel: channel || 'sms',
          trigger_keyword: command,
          original_message: message,
          status: 'pending'
        });

        // Create high-priority notification
        await supabase.from('notification_queue').insert({
          title: '🚨 Human Requested',
          body: `Someone replied ${command} from ${from_number}`,
          priority: 'critical',
          channels: ['sms', 'push'],
          data: { from_number, original_message: message }
        });

        result = {
          success: true,
          message: command === 'STOP' 
            ? `✋ AI STOPPED for this conversation.\nA team member will reach out shortly.`
            : `👋 HUMAN REQUESTED\nA team member will contact you within 1 hour.`
        };
        break;
      }

      case 'HELP': {
        result = {
          success: true,
          message: `📱 COMMAND LIST\n` +
            `• STATUS - Today's metrics\n` +
            `• LEADS - Top 5 hot leads\n` +
            `• PAUSE 2H - Pause AI for 2 hours\n` +
            `• RESUME - Resume AI\n` +
            `• GROWTH/MAINTENANCE/VACATION - Set mode\n` +
            `• CALL [Name] - Queue callback\n` +
            `• HUMAN - Talk to a person`
        };
        break;
      }

      default: {
        result = {
          success: false,
          message: `❓ Unknown command: ${command}\nReply HELP for available commands.`
        };
      }
    }

    // Log the command
    await supabase.from('automation_logs').insert({
      function_name: 'mobile-command',
      status: result.success ? 'completed' : 'error',
      metadata: {
        from_number,
        channel,
        command,
        args,
        result: result.message
      }
    });

    console.log(`[mobile-command] Response: ${result.message}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[mobile-command] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: '❌ Command failed. Try again or reply HELP.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
