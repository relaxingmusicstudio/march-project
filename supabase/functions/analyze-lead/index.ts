import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
   - 10+ trucks = enterprise budget (20 pts)
   - 6-10 = growth budget (16 pts)
   - 2-5 = SMB budget (12 pts)
   - Solo = starter budget (8 pts)

2. Authority (15%): Is this the decision maker?
   - Business owner confirmed = 15 pts
   - Manager/partner = 12 pts
   - Employee/unknown = 5 pts

3. Need (20%): Pain points expressed
   - Acknowledged missed call problem = 20 pts
   - Mentioned lost revenue = 16 pts
   - General interest = 10 pts
   - No pain expressed = 5 pts

4. Timeline (20%): Urgency to act
   - Within 3 months = 20 pts
   - 3-6 months = 15 pts
   - 6-12 months = 8 pts
   - Just exploring = 4 pts

5. Engagement Score (25%): BEHAVIORAL DATA - This is crucial!
   - Engagement score 80-100 = 25 pts (highly engaged)
   - Engagement score 60-79 = 20 pts (engaged)
   - Engagement score 40-59 = 15 pts (moderate)
   - Engagement score 20-39 = 10 pts (low)
   - Engagement score 0-19 = 5 pts (minimal)

BEHAVIORAL SIGNALS TO ANALYZE:
- Returning visitor (visited before) = +10 bonus
- Used revenue calculator = +15 bonus (serious buyer)
- Watched demo/voice demo = +10 bonus
- Viewed pricing section = +10 bonus
- High scroll depth (80%+) = +5 bonus
- Multiple CTA clicks = +5 bonus
- Chatbot engagement = +10 bonus
- Long time on page = +5 bonus
- Exit intent triggered but stayed = +5 bonus

TRAFFIC SOURCE INSIGHTS:
- Paid ads (utm_medium=cpc/ppc) = Higher intent
- Organic search = Research phase but qualified
- Referral = Trust-based, often high quality
- Direct = Returning/brand aware
- Social = Varies, check engagement

BUYING SIGNALS TO DETECT:
- Asked about pricing
- Asked about implementation/setup
- Mentioned specific pain points
- Compared to competitors
- Asked about ROI/results
- Requested demo
- Clicked pricing CTAs
- Used calculator with realistic numbers

OBJECTIONS RAISED:
- Price concerns
- Need to consult partner
- Skeptical about AI
- "Just browsing"
- Timing not right

SENTIMENT JOURNEY:
Track how sentiment changed through the conversation:
- Curious → Interested → Engaged → Ready
- Skeptical → Understanding → Convinced
- Resistant → Open → Persuaded`;

const analysisTool = {
  type: "function",
  function: {
    name: "score_lead",
    description: "Provide comprehensive lead scoring and analysis using conversation + behavioral data",
    parameters: {
      type: "object",
      properties: {
        lead_score: {
          type: "number",
          description: "Overall lead score 0-100"
        },
        lead_temperature: {
          type: "string",
          enum: ["hot", "warm", "cold", "dead"],
          description: "Lead temperature classification"
        },
        lead_intent: {
          type: "string",
          enum: ["ready_to_buy", "evaluating", "researching", "not_interested"],
          description: "Primary intent detected"
        },
        qualification_breakdown: {
          type: "object",
          properties: {
            budget_score: { type: "number" },
            authority_score: { type: "number" },
            need_score: { type: "number" },
            timeline_score: { type: "number" },
            engagement_score: { type: "number" }
          },
          description: "BANT + Engagement qualification scores"
        },
        buying_signals: {
          type: "array",
          items: { type: "string" },
          description: "Detected buying signals from conversation AND behavior"
        },
        behavioral_insights: {
          type: "array",
          items: { type: "string" },
          description: "Key insights from visitor behavior data"
        },
        objections_raised: {
          type: "array",
          items: { type: "string" },
          description: "Objections mentioned during conversation"
        },
        sentiment_journey: {
          type: "array",
          items: { type: "string" },
          description: "Sentiment progression through conversation"
        },
        conversation_summary: {
          type: "string",
          description: "Brief 2-3 sentence summary of the conversation"
        },
        recommended_followup: {
          type: "string",
          description: "Recommended next action for sales team"
        },
        conversion_probability: {
          type: "number",
          description: "Estimated conversion probability 0-100"
        },
        key_insights: {
          type: "array",
          items: { type: "string" },
          description: "Key insights for sales team"
        },
        urgency_level: {
          type: "string",
          enum: ["immediate", "high", "medium", "low"],
          description: "Follow-up urgency"
        },
        traffic_quality: {
          type: "string",
          enum: ["premium", "high", "medium", "low"],
          description: "Traffic source quality assessment"
        },
        engagement_level: {
          type: "string",
          enum: ["highly_engaged", "engaged", "moderate", "low", "minimal"],
          description: "Overall engagement level from behavioral data"
        }
      },
      required: [
        "lead_score",
        "lead_temperature", 
        "lead_intent",
        "qualification_breakdown",
        "buying_signals",
        "behavioral_insights",
        "objections_raised",
        "sentiment_journey",
        "conversation_summary",
        "recommended_followup",
        "conversion_probability",
        "key_insights",
        "urgency_level",
        "traffic_quality",
        "engagement_level"
      ]
    }
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationHistory, leadData, visitorData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing lead:", leadData?.name);
    console.log("Conversation messages:", conversationHistory?.length);
    console.log("Visitor data available:", !!visitorData);
    
    if (visitorData) {
      console.log("Visitor intelligence:", {
        isReturning: visitorData.isReturningVisitor,
        visitCount: visitorData.visitCount,
        engagementScore: visitorData.engagementScore,
        behavioralIntent: visitorData.behavioralIntent,
        calculatorUsed: visitorData.calculatorUsed,
        demoWatched: visitorData.demoWatched,
        ctaClicks: visitorData.ctaClicks?.length || 0
      });
    }

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
Is Returning Visitor: ${visitorData.isReturningVisitor ? 'YES (visited before!)' : 'NO (first visit)'}
Total Visit Count: ${visitorData.visitCount || 1}
First Visit: ${visitorData.firstVisitAt || 'Unknown'}

TRAFFIC ATTRIBUTION:
- Source: ${visitorData.utmSource || 'Direct'}
- Medium: ${visitorData.utmMedium || 'None'}
- Campaign: ${visitorData.utmCampaign || 'None'}
- Referrer: ${visitorData.referrer || 'Direct'}

ENGAGEMENT METRICS:
- Engagement Score: ${visitorData.engagementScore || 0}/100
- Behavioral Intent: ${visitorData.behavioralIntent || 'Unknown'}
- Scroll Depth: ${visitorData.scrollDepth || 0}%
- Time on Page: ${visitorData.timeOnPage || 0} seconds
- Pages Viewed: ${visitorData.pagesViewed || 1}

KEY ACTIONS TAKEN:
- Calculator Used: ${visitorData.calculatorUsed ? 'YES - Shows serious buying intent!' : 'NO'}
- Calculator Data: ${visitorData.calculatorData ? JSON.stringify(visitorData.calculatorData) : 'None'}
- Demo Watched: ${visitorData.demoWatched ? 'YES - High interest signal!' : 'NO'}
- Demo Watch Time: ${visitorData.demoWatchTime || 0} seconds
- Chatbot Engaged: ${visitorData.chatbotEngaged ? 'YES' : 'NO'}
- Exit Intent Triggered: ${visitorData.exitIntentShown ? 'YES (but stayed!)' : 'NO'}

CTA CLICKS (Interest Signals):
${visitorData.ctaClicks?.length > 0 ? visitorData.ctaClicks.map((cta: string) => `- Clicked: ${cta}`).join('\n') : '- No CTA clicks recorded'}

SECTIONS VIEWED:
${visitorData.sectionsViewed?.length > 0 ? visitorData.sectionsViewed.map((section: string) => `- Viewed: ${section}`).join('\n') : '- No sections tracked'}

INTEREST SIGNALS:
${visitorData.interestSignals?.length > 0 ? visitorData.interestSignals.map((signal: string) => `- ${signal}`).join('\n') : '- No specific interest signals'}
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

ANALYSIS INSTRUCTIONS:
======================
1. Weight behavioral data heavily - actions speak louder than words
2. A returning visitor who used the calculator is likely a serious buyer
3. High engagement score (70+) combined with pricing CTA clicks = hot lead
4. Consider traffic source quality (paid ads often indicate buying intent)
5. Factor in time spent on page and sections viewed
6. Provide actionable insights that combine conversation AND behavioral signals

Analyze this lead comprehensively using ALL available data.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: ANALYSIS_PROMPT },
          { role: "user", content: analysisRequest }
        ],
        tools: [analysisTool],
        tool_choice: { type: "function", function: { name: "score_lead" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(JSON.stringify({ error: "AI credits depleted, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI analysis error:", response.status, errorText);
      throw new Error(`AI analysis error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall && toolCall.function?.arguments) {
      const analysis = JSON.parse(toolCall.function.arguments);
      console.log("Lead analysis complete:", {
        score: analysis.lead_score,
        temperature: analysis.lead_temperature,
        probability: analysis.conversion_probability,
        engagementLevel: analysis.engagement_level,
        trafficQuality: analysis.traffic_quality
      });
      
      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("No valid analysis from AI");

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