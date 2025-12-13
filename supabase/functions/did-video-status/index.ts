import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { video_id } = await req.json();

    if (!video_id) {
      throw new Error("video_id is required");
    }

    const DID_API_KEY = Deno.env.get("DID_API_KEY");

    if (!DID_API_KEY) {
      return new Response(JSON.stringify({ 
        error: "D-ID API key not configured",
        status: "error"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get video status from D-ID
    const response = await fetch(`https://api.d-id.com/talks/${video_id}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${DID_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("D-ID status error:", response.status, errorText);
      throw new Error(`D-ID API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("D-ID video status:", data.status, "URL:", data.result_url);

    return new Response(JSON.stringify({
      status: data.status,
      result_url: data.result_url,
      created_at: data.created_at,
      duration: data.duration
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("D-ID status error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
