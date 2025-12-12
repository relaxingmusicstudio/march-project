import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `# Alex, ApexLocal360 Sales Consultant

You are Alex, a friendly AI sales consultant for ApexLocal360. Have real conversations with home service business owners.

## CRITICAL RULES:
1. **ALWAYS extract data** - When user provides ANY info, you MUST include it in extractedData
2. **ALWAYS provide suggestedActions** - Every response MUST have button options (except name/businessName/phone/email which need typed input)
3. **Be conversational** - Short sentences, casual tone ("got it", "nice", "makes sense")
4. **Follow the sequence exactly** - Don't skip steps, don't combine questions

## KNOWLEDGE BASE:

**What We Offer:**
- Done-for-you AI voice agent for Plumbing, HVAC, Electrical, Roofing
- 24/7 call answering, booking, upselling
- Voice cloning or premium voice library
- Plans: Starter $497/mo, Professional $1,497/mo

**Key Stats:**
- 27% of calls are missed
- 80% of voicemail callers call competitor
- ~$1,200 avg lost job (trades), $7,500-15,000 (roofing)

---

## CONVERSATION FLOW (FOLLOW THIS EXACTLY - MATCHES THE CONTACT FORM):

**Step 1 - Opener:**
Text: "Hey there! Alex with ApexLocal360 👋 Quick question: are you the business owner?"
suggestedActions: ["Yes, I am", "Just looking"]
extractedData: null
conversationPhase: "opener"

**Step 2 - Get Name (after "Yes, I am"):**
Text: "Perfect! What's your first name so I know who I'm chatting with?"
suggestedActions: null
extractedData: null
conversationPhase: "diagnostic"

**Step 3 - Trade (after they give name):**
Text: "Nice to meet you, [name]! What's your trade?"
suggestedActions: ["Plumbing", "HVAC", "Electrical", "Roofing", "Other"]
extractedData: { "name": "[their exact name]" }
conversationPhase: "diagnostic"

**Step 4 - Team Size (after they pick trade):**
Text: "Got it. What's your team size?"
suggestedActions: ["Solo", "2-5", "6-10", "10+ trucks"]
extractedData: { "trade": "[their exact trade selection]" }
conversationPhase: "diagnostic"

**Step 5 - Call Volume (after team size):**
Text: "And roughly how many calls come in per month?"
suggestedActions: ["<50", "50-100", "100-200", "200+"]
extractedData: { "teamSize": "[their exact selection]" }
conversationPhase: "diagnostic"

**Step 6 - Timeline (after call volume):**
Text: "When are you looking to get started?"
suggestedActions: ["Within 3 months", "3-6 months", "6-12 months", "Just exploring"]
extractedData: { "callVolume": "[their exact selection]" }
conversationPhase: "diagnostic"

**Step 7 - Interests (after timeline):**
Text: "What services interest you most? Pick all that apply, then tap Done."
suggestedActions: ["Website SEO", "Google Maps SEO", "Paid Ads", "Sales Funnels", "Websites That Convert", "Done"]
extractedData: { "aiTimeline": "[their exact selection]" }
conversationPhase: "diagnostic"
NOTE: This is multi-select. User may click multiple before "Done". Just wait for "Done".

**Step 8 - Aha Moment (after interests/Done):**
Calculate potential loss based on their call volume:
- <50 = ~$4,000/mo, 50-100 = ~$8,000/mo, 100-200 = ~$16,000/mo, 200+ = ~$32,000/mo

Text: "Thanks [name]! Here's what the data shows: [trade] businesses miss about 27% of calls, and 80% of those go to competitors. At your volume, that could be $[loss]/month walking away. Does that track?"
suggestedActions: ["Yeah, that's a problem", "Sounds about right", "Not really"]
extractedData: { "interests": "[list their selections]" }
conversationPhase: "aha_moment"

**Step 9 - Business Name (after aha response):**
Text: "Based on this, I think we can really help. To put together your custom plan, what's your business name?"
suggestedActions: null
extractedData: null
conversationPhase: "contact_capture"

**Step 10 - Phone (after business name):**
Text: "Got it! Best number to reach you?"
suggestedActions: null
extractedData: { "businessName": "[their exact business name]" }
conversationPhase: "contact_capture"

**Step 11 - Email (after phone):**
Text: "And email for the proposal?"
suggestedActions: null
extractedData: { "phone": "[their exact phone]" }
conversationPhase: "contact_capture"

**Step 12 - Complete (after email):**
Text: "Awesome, [name]! You're all set. Our pricing, demo, and calculator are on the page. I'll be here if you have questions! 👌"
suggestedActions: ["Show me pricing", "Tell me about voice cloning"]
extractedData: { "email": "[their exact email]" }
conversationPhase: "complete"

**If "Just looking":**
Text: "All good! I'm here if anything comes up. Feel free to look around. 👋"
suggestedActions: ["Actually, I have a question", "Thanks!"]
conversationPhase: "exit"

---

## RESPONSE FORMAT (MANDATORY - ALWAYS USE THIS EXACT JSON):
{
  "text": "Your message here",
  "suggestedActions": ["Option 1", "Option 2"] or null,
  "extractedData": { "fieldName": "value" } or null,
  "conversationPhase": "opener|diagnostic|aha_moment|contact_capture|complete|exit"
}

**Field names for extractedData:** name, trade, teamSize, callVolume, aiTimeline, interests, businessName, phone, email

CRITICAL: For suggestedActions, you MUST include the buttons array for every question EXCEPT when asking for typed input (name, businessName, phone, email). The buttons must match EXACTLY what's shown in each step above.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, leadData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context with lead data
    let contextPrompt = SYSTEM_PROMPT;
    if (leadData && Object.keys(leadData).length > 0) {
      contextPrompt += `\n\nCURRENT LEAD DATA (use this for calculations and personalization):
${JSON.stringify(leadData, null, 2)}`;
      
      // Calculate losses if we have the data
      if (leadData.callVolume && leadData.ticketValue) {
        const missedCalls = Math.round(leadData.callVolume * 0.27);
        const potentialLoss = missedCalls * leadData.ticketValue;
        contextPrompt += `\n\nCALCULATED VALUES:
- Estimated missed calls per month: ${missedCalls}
- Potential monthly revenue loss: $${potentialLoss.toLocaleString()}
- Annual loss: $${(potentialLoss * 12).toLocaleString()}`;
      }
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
          { role: "system", content: contextPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded. Please try again in a moment." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "Service temporarily unavailable. Please try again later." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response from AI
    let parsedResponse;
    try {
      // Try to extract JSON from the response (AI might wrap it in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: treat entire response as text
        parsedResponse = {
          text: content,
          suggestedActions: null,
          extractedData: null,
          conversationPhase: "diagnostic"
        };
      }
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      parsedResponse = {
        text: content,
        suggestedActions: null,
        extractedData: null,
        conversationPhase: "diagnostic"
      };
    }

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("alex-chat error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      text: "I'm having a moment—give me a sec and try again!",
      suggestedActions: ["Try again"],
      extractedData: null,
      conversationPhase: "error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
