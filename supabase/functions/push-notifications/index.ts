import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  action: 'send' | 'get_pending' | 'mark_read' | 'subscribe' | 'get_preferences';
  notification_id?: string;
  user_id?: string;
  title?: string;
  body?: string;
  priority?: 'critical' | 'important' | 'informative';
  data?: Record<string, unknown>;
  subscription?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, notification_id, user_id, title, body, priority, data }: NotificationRequest = await req.json();

    console.log(`[push-notifications] Action: ${action}`);

    switch (action) {
      case 'send': {
        if (!title || !body) {
          throw new Error('title and body are required');
        }

        const notificationPriority = priority || 'informative';
        
        // Get notification routing config
        const { data: config } = await supabase
          .from('system_config')
          .select('config_value')
          .eq('config_key', 'notification_defaults')
          .single();

        const defaults = config?.config_value || {
          critical_channels: ['sms', 'push'],
          important_channels: ['push'],
          informative_channels: ['in_app']
        };

        // Determine channels based on priority
        const channelKey = `${notificationPriority}_channels` as keyof typeof defaults;
        const channels = defaults[channelKey] || ['in_app'];

        // Insert notification into queue
        const { data: notification, error } = await supabase
          .from('notification_queue')
          .insert({
            user_id,
            title,
            body,
            priority: notificationPriority,
            channels,
            data: data || {},
            status: 'pending'
          })
          .select()
          .single();

        if (error) throw error;

        // Process immediate channels
        const results: Record<string, string> = {};

        if (channels.includes('push')) {
          // In production, this would send to FCM/APNs
          // For now, we mark as sent for PWA to poll
          results.push = 'queued_for_pwa';
        }

        if (channels.includes('sms') && notificationPriority === 'critical') {
          // Use Twilio to send critical SMS
          const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
          const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
          const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

          if (twilioSid && twilioToken && twilioPhone) {
            // Get user's phone number (would need to be stored)
            // For now, log that we would send SMS
            console.log(`[push-notifications] Would send SMS for critical notification: ${title}`);
            results.sms = 'would_send_if_phone_configured';
          } else {
            results.sms = 'twilio_not_configured';
          }
        }

        // Update notification as sent
        await supabase
          .from('notification_queue')
          .update({ sent_at: new Date().toISOString(), status: 'sent' })
          .eq('id', notification.id);

        return new Response(JSON.stringify({
          success: true,
          notification_id: notification.id,
          channels,
          results
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_pending': {
        // Get unread notifications for PWA polling
        const { data: notifications } = await supabase
          .from('notification_queue')
          .select('*')
          .eq('status', 'sent')
          .order('created_at', { ascending: false })
          .limit(50);

        return new Response(JSON.stringify({
          notifications: notifications || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'mark_read': {
        if (!notification_id) {
          throw new Error('notification_id is required');
        }

        await supabase
          .from('notification_queue')
          .update({ status: 'read' })
          .eq('id', notification_id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_preferences': {
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user_id);

        return new Response(JSON.stringify({
          preferences: prefs || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('[push-notifications] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
