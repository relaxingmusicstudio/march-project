import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChat, parseAIError } from "../_shared/ai.ts";

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

    const result = await aiChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      purpose: "content_generation",
    });

    const generatedContent = result.text;

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
    const parsed = parseAIError(error);
    return new Response(JSON.stringify({ error: parsed.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
