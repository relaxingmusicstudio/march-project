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
    const { topic, format, platform, niche = "HVAC", idea_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build prompt based on format
    let systemPrompt = `You are an expert content creator for the ${niche} industry.`;
    let userPrompt = "";

    switch (format) {
      case "social":
        systemPrompt += " Create engaging social media posts that drive engagement.";
        userPrompt = `Create a ${platform} post about: ${topic}. Include relevant hashtags and a call to action. Keep it concise and engaging.`;
        break;
      case "blog":
        systemPrompt += " Write informative, SEO-optimized blog articles.";
        userPrompt = `Write a blog article about: ${topic}. Include an engaging introduction, 3-5 key points with subheadings, and a conclusion with a call to action. Target 500-800 words.`;
        break;
      case "ad":
        systemPrompt += " Create compelling ad copy that converts.";
        userPrompt = `Create ${platform} ad copy for: ${topic}. Include a headline (max 30 chars), description (max 90 chars), and call to action. Focus on benefits and urgency.`;
        break;
      case "email":
        systemPrompt += " Write persuasive email marketing content.";
        userPrompt = `Write a marketing email about: ${topic}. Include a compelling subject line, engaging opening, clear value proposition, and strong CTA.`;
        break;
      default:
        userPrompt = `Create content about: ${topic}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const generatedContent = aiData.choices?.[0]?.message?.content || "";

    // Extract title (first line or generated)
    const lines = generatedContent.split("\n").filter((l: string) => l.trim());
    const title = lines[0]?.replace(/^#\s*/, "").substring(0, 100) || `${format} about ${topic}`;

    // Save to content table
    const { data: savedContent, error: saveError } = await supabase
      .from("content")
      .insert({
        idea_id,
        content_type: format,
        title,
        body: generatedContent,
        platform,
        status: "pending"
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving content:", saveError);
    }

    console.log(`Generated ${format} content for: ${topic}`);

    return new Response(JSON.stringify({ 
      content: generatedContent,
      title,
      saved: savedContent
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Content generator error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
