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
    const { topic, script, avatar_id = "default", voice_id = "default", idea_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get API key from settings
    const { data: settings } = await supabase
      .from("api_settings")
      .select("setting_value")
      .eq("setting_key", "HEYGEN_API_KEY")
      .single();

    const apiKey = settings?.setting_value;

    if (!apiKey) {
      // Return mock response if no API key
      const mockResponse = {
        video_id: `mock_${Date.now()}`,
        status: "pending",
        message: "HeyGen API key not configured. Configure it in Settings to generate real videos.",
        mock: true
      };

      // Save mock content
      await supabase.from("content").insert({
        idea_id,
        content_type: "video",
        title: `Video: ${topic?.substring(0, 50) || "AI Avatar Video"}`,
        body: script || `Generated script for: ${topic}`,
        status: "pending"
      });

      return new Response(JSON.stringify(mockResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Generate script if not provided
    let videoScript = script;
    if (!videoScript && topic) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const scriptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { 
                role: "system", 
                content: "You are a video script writer. Write concise, engaging scripts for AI avatar videos. Keep scripts under 60 seconds when read aloud. Be conversational and professional." 
              },
              { 
                role: "user", 
                content: `Write a short video script about: ${topic}. Make it engaging and suitable for a professional AI avatar presentation.` 
              }
            ]
          })
        });

        if (scriptResponse.ok) {
          const scriptData = await scriptResponse.json();
          videoScript = scriptData.choices?.[0]?.message?.content || "";
        }
      }
    }

    // Call HeyGen API
    const heygenResponse = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        video_inputs: [{
          character: {
            type: "avatar",
            avatar_id: avatar_id,
            avatar_style: "normal"
          },
          voice: {
            type: "text",
            input_text: videoScript,
            voice_id: voice_id
          }
        }],
        dimension: {
          width: 1280,
          height: 720
        }
      })
    });

    if (!heygenResponse.ok) {
      const errorText = await heygenResponse.text();
      console.error("HeyGen API error:", heygenResponse.status, errorText);
      throw new Error(`HeyGen API error: ${heygenResponse.status}`);
    }

    const heygenData = await heygenResponse.json();

    // Save to content table
    const { data: savedContent, error: saveError } = await supabase
      .from("content")
      .insert({
        idea_id,
        content_type: "video",
        title: `Video: ${topic?.substring(0, 50) || "AI Avatar Video"}`,
        body: videoScript,
        status: "pending"
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving content:", saveError);
    }

    console.log(`Generated HeyGen video for: ${topic}`);

    return new Response(JSON.stringify({ 
      video_id: heygenData.data?.video_id,
      status: heygenData.data?.status,
      script: videoScript,
      saved: savedContent
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("HeyGen video error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
