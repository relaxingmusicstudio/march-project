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
    const { seed_keyword } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Use AI to generate keyword suggestions
    const result = await aiChat({
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
      ],
      purpose: "keyword_planning",
    });

    let content = result.text;

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
    const parsed = parseAIError(error);
    return new Response(JSON.stringify({ error: parsed.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
