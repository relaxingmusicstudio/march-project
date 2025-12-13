import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integration_key } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the API key from settings
    const { data: settings } = await supabase
      .from("api_settings")
      .select("setting_value")
      .eq("setting_key", integration_key)
      .single();

    const apiKey = settings?.setting_value;

    if (!apiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "API key not configured" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let success = false;
    let message = "";

    // Test based on integration type
    switch (integration_key) {
      case "YOUTUBE_API_KEY":
      case "GOOGLE_API_KEY": {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&maxResults=1&key=${apiKey}`
        );
        success = response.ok;
        message = success ? "YouTube API connection successful" : "Invalid API key";
        break;
      }

      case "META_ACCESS_TOKEN": {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/me?access_token=${apiKey}`
        );
        success = response.ok;
        message = success ? "Meta API connection successful" : "Invalid access token";
        break;
      }

      case "HEYGEN_API_KEY": {
        const response = await fetch("https://api.heygen.com/v2/avatars", {
          headers: { "X-Api-Key": apiKey }
        });
        success = response.ok;
        message = success ? "HeyGen API connection successful" : "Invalid API key";
        break;
      }

      case "TWILIO_ACCOUNT_SID": {
        // For Twilio, we need both SID and Auth Token
        const { data: authSettings } = await supabase
          .from("api_settings")
          .select("setting_value")
          .eq("setting_key", "TWILIO_AUTH_TOKEN")
          .single();

        if (!authSettings?.setting_value) {
          message = "Twilio Auth Token not configured";
          break;
        }

        const credentials = btoa(`${apiKey}:${authSettings.setting_value}`);
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${apiKey}.json`,
          { headers: { Authorization: `Basic ${credentials}` } }
        );
        success = response.ok;
        message = success ? "Twilio API connection successful" : "Invalid credentials";
        break;
      }

      case "TWILIO_AUTH_TOKEN": {
        // Test with Account SID
        const { data: sidSettings } = await supabase
          .from("api_settings")
          .select("setting_value")
          .eq("setting_key", "TWILIO_ACCOUNT_SID")
          .single();

        if (!sidSettings?.setting_value) {
          message = "Twilio Account SID not configured";
          break;
        }

        const credentials = btoa(`${sidSettings.setting_value}:${apiKey}`);
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sidSettings.setting_value}.json`,
          { headers: { Authorization: `Basic ${credentials}` } }
        );
        success = response.ok;
        message = success ? "Twilio API connection successful" : "Invalid credentials";
        break;
      }

      case "WHATSAPP_ACCESS_TOKEN": {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/me?access_token=${apiKey}`
        );
        success = response.ok;
        message = success ? "WhatsApp API connection successful" : "Invalid access token";
        break;
      }

      case "GOOGLE_ADS_DEVELOPER_TOKEN": {
        // Google Ads requires OAuth, so we just verify the token format
        success = apiKey.length > 10;
        message = success ? "Developer token format valid" : "Invalid token format";
        break;
      }

      default:
        message = "Unknown integration type";
    }

    console.log(`Integration test for ${integration_key}: ${success ? "SUCCESS" : "FAILED"}`);

    return new Response(JSON.stringify({ success, message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Integration test error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Test failed" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
