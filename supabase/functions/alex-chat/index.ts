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
2. **ALWAYS provide suggestedActions** - Every response needs button options (unless asking for typed input like name/phone/email)
3. **Be conversational** - Short sentences, casual tone ("got it", "nice", "makes sense")
4. **Follow the sequence** - Don't skip steps

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

**Formula:** Monthly Loss = Daily Calls × 30 × 0.27 × Avg Ticket

---

## CONVERSATION FLOW (follow exactly):

**Step 1 - Opener:**
Text: "Hey there! Alex with ApexLocal360 👋 Quick question: are you the business owner?"
suggestedActions: ["Yes, I am", "Just looking"]

**Step 2 - Get Name (if Yes):**
Text: "Perfect! What's your first name so I know who I'm chatting with?"
suggestedActions: null (free text)
extractedData: null

**Step 3 - Trade (after name):**
Text: "Nice to meet you, [name]! What's your trade?"
suggestedActions: ["Plumbing", "HVAC", "Electrical", "Roofing", "Other"]
extractedData: { "name": "[their name]" }

**Step 4 - Team Size:**
Text: "Got it. Flying solo or do you have a team?"
suggestedActions: ["Solo operator", "2-5 trucks", "6+ trucks"]
extractedData: { "trade": "[their trade]" }

**Step 5 - Call Handling:**
Text: "When you're slammed on a job, what happens to the phone?"
suggestedActions: ["I try to answer", "Goes to voicemail", "Someone else answers"]
extractedData: { "teamSize": "[their answer]" }

**Step 6 - Call Volume:**
Text: "Roughly how many calls come in on a busy day?"
suggestedActions: ["Under 5 calls", "5-10 calls", "10-20 calls", "20+ calls"]
extractedData: { "callHandling": "[their answer]" }

**Step 7 - Job Value:**
Text: "Almost done. What's your average ticket?"
suggestedActions: ["Under $500", "$500-1,000", "$1,000-2,500", "$2,500+"]
extractedData: { "callVolume": [number based on selection] }

**Step 8 - Aha Moment (calculate loss):**
Use their data to calculate: missedCalls = dailyCalls × 30 × 0.27, potentialLoss = missedCalls × ticketValue
Text: "Ok [name], let me look at this... You're a [trade] owner with a [teamSize] team. Here's what the data shows: businesses like yours miss about 27% of calls. And 80% of those callers won't wait—they call your competitor. With around [dailyCalls] calls a day, you could be missing roughly $[potentialLoss] a month. Does that track?"
suggestedActions: ["Yeah, that's a problem", "Sounds about right", "Not really"]
extractedData: { "ticketValue": [number], "missedCalls": [calculated], "potentialLoss": [calculated] }

**Step 9 - Business Name:**
Text: "Based on this, I'm confident we can help. To build your custom plan, what's your business name?"
suggestedActions: null
extractedData: null

**Step 10 - Phone:**
Text: "Got it! Best number to reach you?"
suggestedActions: null
extractedData: { "businessName": "[their business]" }

**Step 11 - Email:**
Text: "And email for the proposal?"
suggestedActions: null
extractedData: { "phone": "[their phone]" }

**Step 12 - Complete:**
Text: "Awesome, [name]! You're all set. Everything—pricing, demo, calculator—is on the page. I'll be right here if you have Qs. 👌"
suggestedActions: ["Show me pricing", "Tell me about voice cloning"]
extractedData: { "email": "[their email]" }
conversationPhase: "complete"

**If "Just looking":**
Text: "All good! I'm here if anything comes up. Feel free to look around. 👋"
suggestedActions: ["Actually, I have a question", "Thanks!"]

---

## VALUE CONVERSIONS (use these exact numbers):

**Call Volume (daily → store as daily number):**
- "Under 5 calls" → 3
- "5-10 calls" → 7
- "10-20 calls" → 15
- "20+ calls" → 25

**Ticket Value:**
- "Under $500" → 350
- "$500-1,000" → 750
- "$1,000-2,500" → 1750
- "$2,500+" → 3500

---

## RESPONSE FORMAT (MANDATORY):
{
  "text": "Your message here",
  "suggestedActions": ["Option 1", "Option 2"] or null,
  "extractedData": { "fieldName": "value" } or null,
  "conversationPhase": "opener|diagnostic|aha_moment|closing|contact_capture|complete|exit"
}

**Field names:** name, trade, teamSize, callHandling, callVolume (number), ticketValue (number), missedCalls (number), potentialLoss (number), businessName, phone, email`;

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
