import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChat } from "../_shared/ai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANALYSIS_PROMPT = `You are an expert lead scoring analyst for HVAC businesses. Analyze the conversation AND behavioral data to provide a comprehensive lead score.

SCORING CRITERIA (0-100 scale):

LEAD TEMPERATURE:
- Hot (80-100): Ready to buy, expressed urgency, timeline within 3 months
- Warm (50-79): Interested but needs nurturing, timeline 3-6 months
- Cold (20-49): Just exploring, timeline 6+ months or unclear
- Dead (0-19): Not interested, bad fit, or disengaged

QUALIFICATION FACTORS (weight each):
1. Budget Signals (20%): Team size indicates budget capacity
2. Authority (15%): Is this the decision maker?
3. Need (20%): Pain points expressed
4. Timeline (20%): Urgency to act
5. Engagement Score (25%): BEHAVIORAL DATA - This is crucial!

BEHAVIORAL SIGNALS TO ANALYZE:
- Returning visitor = +10 bonus
- Used revenue calculator = +15 bonus
- Watched demo = +10 bonus
- Viewed pricing section = +10 bonus
- High scroll depth (80%+) = +5 bonus
- Multiple CTA clicks = +5 bonus

Return your analysis as JSON with these fields:
- lead_score (number 0-100)
- lead_temperature ("hot" | "warm" | "cold" | "dead")
- lead_intent ("ready_to_buy" | "evaluating" | "researching" | "not_interested")
- qualification_breakdown (object with budget_score, authority_score, need_score, timeline_score, engagement_score)
- buying_signals (array of strings)
- behavioral_insights (array of strings)
- objections_raised (array of strings)
- sentiment_journey (array of strings)
- conversation_summary (string)
- recommended_followup (string)
- conversion_probability (number 0-100)
- key_insights (array of strings)
- urgency_level ("immediate" | "high" | "medium" | "low")
- traffic_quality ("premium" | "high" | "medium" | "low")
- engagement_level ("highly_engaged" | "engaged" | "moderate" | "low" | "minimal")`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationHistory, leadData, visitorData } = await req.json();

    console.log("Analyzing lead:", leadData?.name);
    console.log("Conversation messages:", conversationHistory?.length);
    console.log("Visitor data available:", !!visitorData);

    // Build conversation transcript
    const transcript = conversationHistory?.map((msg: { role: string; content: string }) => 
      `${msg.role === 'user' ? 'PROSPECT' : 'ALEX'}: ${msg.content}`
    ).join('\n') || 'No conversation data';

    // Build visitor intelligence section
    let visitorIntelligence = 'No visitor behavioral data available';
    if (visitorData) {
      visitorIntelligence = `
VISITOR BEHAVIORAL DATA:
========================
Visitor ID: ${visitorData.visitorId || 'Unknown'}
Is Returning Visitor: ${visitorData.isReturningVisitor ? 'YES' : 'NO'}
Total Visit Count: ${visitorData.visitCount || 1}
Engagement Score: ${visitorData.engagementScore || 0}/100
Calculator Used: ${visitorData.calculatorUsed ? 'YES' : 'NO'}
Demo Watched: ${visitorData.demoWatched ? 'YES' : 'NO'}
UTM Source: ${visitorData.utmSource || 'Direct'}
`;
    }

    const analysisRequest = `
LEAD CONTACT DATA:
==================
${JSON.stringify(leadData, null, 2)}

${visitorIntelligence}

CONVERSATION TRANSCRIPT:
========================
${transcript}

Analyze this lead comprehensively using ALL available data. Return ONLY valid JSON.`;

    const result = await aiChat({
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT },
        { role: 'user', content: analysisRequest }
      ],
    });

    // Try to parse as JSON
    let analysis;
    try {
      // Clean up response - remove markdown code blocks if present
      let jsonText = result.text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      analysis = JSON.parse(jsonText.trim());
    } catch {
      // If can't parse, return default
      console.log("Could not parse AI response as JSON, using defaults");
      analysis = {
        lead_score: 50,
        lead_temperature: "warm",
        lead_intent: "evaluating",
        qualification_breakdown: { budget_score: 12, authority_score: 10, need_score: 10, timeline_score: 8, engagement_score: 10 },
        buying_signals: [],
        behavioral_insights: ["Analysis completed"],
        objections_raised: [],
        sentiment_journey: ["interested"],
        conversation_summary: result.text.slice(0, 200),
        recommended_followup: "Standard follow-up sequence",
        conversion_probability: 30,
        key_insights: ["Lead analyzed"],
        urgency_level: "medium",
        traffic_quality: "medium",
        engagement_level: "moderate"
      };
    }

    console.log("Lead analysis complete:", {
      score: analysis.lead_score,
      temperature: analysis.lead_temperature,
      provider: result.provider
    });
    
    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("analyze-lead error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      lead_score: 50,
      lead_temperature: "warm",
      lead_intent: "evaluating",
      qualification_breakdown: { budget_score: 12, authority_score: 10, need_score: 10, timeline_score: 8, engagement_score: 10 },
      buying_signals: [],
      behavioral_insights: ["Analysis unavailable - using defaults"],
      objections_raised: [],
      sentiment_journey: ["unknown"],
      conversation_summary: "Analysis unavailable",
      recommended_followup: "Standard follow-up sequence",
      conversion_probability: 30,
      key_insights: ["Analysis failed - use default scoring"],
      urgency_level: "medium",
      traffic_quality: "medium",
      engagement_level: "moderate"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
