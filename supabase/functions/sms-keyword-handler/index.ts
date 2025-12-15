import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface KeywordConfig {
  keyword: string;
  response_template: string;
  auto_response: boolean;
  routing_action: string;
  funnel_id?: string;
  lead_tags?: string[];
  capture_fields?: string[];
}

const DEFAULT_KEYWORDS: Record<string, KeywordConfig> = {
  "HVAC": {
    keyword: "HVAC",
    response_template: "Thanks for your interest in HVAC services! Reply YES to get a free consultation call within 24 hours. Msg rates may apply.",
    auto_response: true,
    routing_action: "add_to_dialer",
    lead_tags: ["sms_optin", "hvac_interest"],
    capture_fields: ["phone", "optin_keyword"],
  },
  "HEAT": {
    keyword: "HEAT",
    response_template: "Need heating help? Reply YES for a priority callback about heating services. Msg rates may apply.",
    auto_response: true,
    routing_action: "add_to_dialer",
    lead_tags: ["sms_optin", "heating_interest"],
    capture_fields: ["phone", "optin_keyword"],
  },
  "AC": {
    keyword: "AC",
    response_template: "AC issues? Reply YES for fast AC service quotes! Msg rates may apply.",
    auto_response: true,
    routing_action: "add_to_dialer",
    lead_tags: ["sms_optin", "ac_interest"],
    capture_fields: ["phone", "optin_keyword"],
  },
  "STOP": {
    keyword: "STOP",
    response_template: "You've been unsubscribed. Reply START to opt back in.",
    auto_response: true,
    routing_action: "unsubscribe",
    lead_tags: ["unsubscribed"],
    capture_fields: [],
  },
  "YES": {
    keyword: "YES",
    response_template: "Great! You're confirmed for a callback. A specialist will reach out within 24 hours. Reply STOP to opt out.",
    auto_response: true,
    routing_action: "confirm_optin",
    lead_tags: ["confirmed_optin"],
    capture_fields: [],
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const contentType = req.headers.get("content-type") || "";
    let from: string, body: string, to: string, messageSid: string;

    // Handle both Twilio webhook (form-urlencoded) and API calls (JSON)
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      from = formData.get("From") as string;
      to = formData.get("To") as string;
      body = formData.get("Body") as string;
      messageSid = formData.get("MessageSid") as string;
    } else {
      const json = await req.json();
      from = json.from;
      to = json.to;
      body = json.body;
      messageSid = json.message_sid || `manual-${Date.now()}`;
    }

    console.log(`[sms-keyword-handler] From: ${from}, Body: "${body}"`);

    const normalizedPhone = from?.replace(/\D/g, "");
    const keyword = body?.trim().toUpperCase();

    // Check for keyword match
    let matchedKeyword = DEFAULT_KEYWORDS[keyword];

    // Also check database for custom keywords
    const { data: customKeyword } = await supabase
      .from("sms_keywords")
      .select("*")
      .eq("keyword", keyword)
      .eq("is_active", true)
      .single();

    if (customKeyword) {
      matchedKeyword = {
        keyword: customKeyword.keyword,
        response_template: customKeyword.response_template,
        auto_response: customKeyword.auto_response,
        routing_action: customKeyword.routing_action || "add_to_dialer",
        funnel_id: customKeyword.funnel_id,
        lead_tags: customKeyword.lead_tags || [],
        capture_fields: customKeyword.capture_fields || [],
      };

      // Update usage stats
      await supabase
        .from("sms_keywords")
        .update({
          total_responses: (customKeyword.total_responses || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", customKeyword.id);
    }

    if (!matchedKeyword) {
      console.log(`[sms-keyword-handler] No keyword match for: "${keyword}"`);
      
      // Still log the message for manual review
      await supabase.from("messages_unified").insert({
        conversation_id: null,
        direction: "inbound",
        content: body,
        status: "pending_review",
        is_mock: false,
        metadata: {
          from,
          to,
          twilio_sid: messageSid,
          unmatched_keyword: true,
        },
      });

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
      );
    }

    console.log(`[sms-keyword-handler] Matched keyword: ${matchedKeyword.keyword}, Action: ${matchedKeyword.routing_action}`);

    // Find or create lead
    let lead;
    const { data: existingLead } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", normalizedPhone)
      .single();

    if (existingLead) {
      lead = existingLead;
      
      // Update lead with new tags
      const existingTags = existingLead.interests || [];
      const newTags = [...new Set([...existingTags, ...(matchedKeyword.lead_tags || [])])];
      
      await supabase
        .from("leads")
        .update({
          interests: newTags,
          consent_to_sms: matchedKeyword.routing_action !== "unsubscribe",
          consent_date: new Date().toISOString(),
          consent_source: `sms_keyword_${matchedKeyword.keyword}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLead.id);
    } else {
      // Create new lead
      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          phone: normalizedPhone,
          source: "sms_keyword",
          source_detail: matchedKeyword.keyword,
          consent_to_sms: true,
          consent_to_call: true,
          consent_date: new Date().toISOString(),
          consent_source: `sms_keyword_${matchedKeyword.keyword}`,
          interests: matchedKeyword.lead_tags || [],
          status: "new",
          lead_score: 70, // SMS opt-in shows high intent
          lead_temperature: "warm",
        })
        .select()
        .single();

      if (leadError) throw leadError;
      lead = newLead;
      console.log(`[sms-keyword-handler] Created new lead: ${lead.id}`);
    }

    // Handle routing actions
    if (matchedKeyword.routing_action === "add_to_dialer" && lead) {
      // Check if already in queue
      const { data: existingQueue } = await supabase
        .from("dialer_queue")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("status", "pending")
        .single();

      if (!existingQueue) {
        await supabase.from("dialer_queue").insert({
          lead_id: lead.id,
          phone_number: normalizedPhone,
          priority: 80, // High priority for SMS opt-ins
          consent_verified: true,
          consent_source: `sms_keyword_${matchedKeyword.keyword}`,
          notes: `SMS opt-in via keyword: ${matchedKeyword.keyword}`,
          status: "pending",
        });
        console.log(`[sms-keyword-handler] Added to dialer queue`);
      }
    }

    if (matchedKeyword.routing_action === "unsubscribe" && lead) {
      await supabase
        .from("leads")
        .update({
          consent_to_sms: false,
          consent_to_call: false,
          do_not_call: true,
          dnc_date: new Date().toISOString(),
          dnc_reason: "SMS STOP keyword",
        })
        .eq("id", lead.id);

      // Remove from dialer queue
      await supabase
        .from("dialer_queue")
        .update({ status: "cancelled" })
        .eq("lead_id", lead.id)
        .eq("status", "pending");

      console.log(`[sms-keyword-handler] Unsubscribed lead`);
    }

    if (matchedKeyword.routing_action === "confirm_optin" && lead) {
      await supabase
        .from("leads")
        .update({
          consent_to_sms: true,
          consent_to_call: true,
          lead_temperature: "hot",
          lead_score: Math.min(100, (lead.lead_score || 70) + 10),
        })
        .eq("id", lead.id);

      // Bump priority in dialer queue
      await supabase
        .from("dialer_queue")
        .update({ priority: 95 })
        .eq("lead_id", lead.id)
        .eq("status", "pending");

      console.log(`[sms-keyword-handler] Confirmed opt-in, bumped priority`);
    }

    // Log the consent action
    await supabase.from("consent_audit_log").insert({
      lead_id: lead?.id,
      action: matchedKeyword.routing_action,
      channel: "sms",
      source: `keyword_${matchedKeyword.keyword}`,
      consent_text: body,
    });

    // Send auto-response if configured
    let responseXml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    
    if (matchedKeyword.auto_response && matchedKeyword.response_template) {
      const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");
      
      if (twilioPhone) {
        responseXml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${matchedKeyword.response_template}</Message></Response>`;
        console.log(`[sms-keyword-handler] Sending auto-response`);
      } else {
        // Queue the response for when Twilio is configured
        await supabase.from("messages_unified").insert({
          conversation_id: null,
          direction: "outbound",
          content: matchedKeyword.response_template,
          status: "queued",
          is_mock: true,
          metadata: {
            to: from,
            from: "pending_twilio_number",
            keyword_response: true,
          },
        });
        console.log(`[sms-keyword-handler] Auto-response queued (no Twilio number)`);
      }
    }

    return new Response(responseXml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("[sms-keyword-handler] Error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/xml" } }
    );
  }
});
