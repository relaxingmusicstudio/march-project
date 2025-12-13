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
    const { seed_keyword } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use AI to generate keyword suggestions
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an SEO and keyword research expert. Generate keyword suggestions in JSON format.
            For each keyword, estimate:
            - search_volume: monthly searches (number between 100-50000)
            - competition: "low", "medium", or "high"
            - cpc_estimate: cost per click in dollars (number between 0.50-15.00)
            
            Return ONLY a valid JSON array, no markdown or explanation.` 
          },
          { 
            role: "user", 
            content: `Generate 15 related keyword suggestions for: "${seed_keyword}"
            
            Include:
            - Long-tail variations
            - Question-based keywords
            - Local variations (e.g., "near me")
            - Commercial intent keywords
            
            Return as JSON array with format:
            [{"keyword": "...", "search_volume": 1000, "competition": "low", "cpc_estimate": 2.50}]` 
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    let content = aiData.choices?.[0]?.message?.content || "[]";

    // Clean up response (remove markdown code blocks if present)
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let keywords = [];
    try {
      keywords = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      // Generate fallback keywords
      keywords = [
        { keyword: seed_keyword, search_volume: 5000, competition: "medium", cpc_estimate: 3.50 },
        { keyword: `${seed_keyword} near me`, search_volume: 2500, competition: "low", cpc_estimate: 4.00 },
        { keyword: `best ${seed_keyword}`, search_volume: 1800, competition: "medium", cpc_estimate: 3.75 },
        { keyword: `${seed_keyword} cost`, search_volume: 1200, competition: "low", cpc_estimate: 2.50 },
        { keyword: `how much does ${seed_keyword} cost`, search_volume: 800, competition: "low", cpc_estimate: 2.00 }
      ];
    }

    // Save to keywords table
    for (const kw of keywords) {
      await supabase.from("keywords").upsert({
        keyword: kw.keyword,
        search_volume: kw.search_volume,
        competition: kw.competition,
        cpc_estimate: kw.cpc_estimate,
        status: "new"
      }, { onConflict: "keyword" });
    }

    console.log(`Generated ${keywords.length} keywords for: ${seed_keyword}`);

    return new Response(JSON.stringify({ 
      keywords,
      seed_keyword
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Keyword planner error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
