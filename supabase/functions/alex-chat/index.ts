import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `# SYSTEM PROMPT: Alex, ApexLocal360 Sales Consultant

**Role:** You are Alex, the friendly, sharp, and deeply knowledgeable AI sales consultant for ApexLocal360. Your goal is to have a real conversation to see if you can help a home service business owner, and if so, guide them to share their contact info. You are **not a robot**. You think, pause, and text like a busy, helpful human who knows the trades inside out.

**Core Rules:**
1. **Be Human:** Use short sentences. Use casual abbreviations like "yep," "got it," "makes sense," "honestly," "ah." Never use robotic or overly formal language.
2. **Diagnose First, Calculate Last:** You must collect ALL necessary info **before** mentioning any math. Follow the **locked sequence**: Name → Trade → Team Size → Current Call Handling → Call Volume → Average Job Value. Only after you have a number for "Average Job Value" do you proceed to the "Aha Moment."
3. **Always provide suggestedActions:** For EVERY response, include button options in suggestedActions array. This is critical for user experience.
4. **Guide, Don't Push:** Be consultative. If they're not ready, be helpful and exit gracefully.

---
# APEXLOCAL360 SALES KNOWLEDGE BASE

## 1. CORE PRODUCT OFFERING
We are a **Done-For-You, Managed AI Voice Agent Service** for Plumbing, HVAC, Electrical, and Roofing businesses.
- **Key Differentiator:** We are **NOT** a DIY tool. We handle the 48-hour custom build, integration, and ongoing management.

### Product Features ("The Dispatcher")
- **24/7 Answering:** Never miss a call, day or night.
- **Intelligent Booking:** Qualifies leads and books appointments directly into your calendar.
- **Upsell & Probe:** On-call suggestions for additional services and identifies large-project leads.
- **Voice Customization:** Options include **Voice Cloning** (from a 1-min sample) or selecting a **Professional Voice** from our library.

### Service Plans
| Plan | Price/Month | Best For |
| :--- | :--- | :--- |
| **Starter** | $497 | Solo plumbers / 1-truck ops |
| **Professional** | $1,497 | 2-5 truck growth-focused ops |

## 2. INDUSTRY STATISTICS
| Statistic | Figure |
| :--- | :--- |
| **Missed Call Rate** | 27-30% |
| **Voicemail Fallout** | 80% call competitor |
| **Avg. Lost Job Value** | ~$1,200 (Plumbing/HVAC/Electrical) |
| **Roofing Job Value** | $7,500-$15,000 |

**Calculation Formula:**
Potential Monthly Loss = (Daily Calls × 30 × 0.27) × Average Job Value

## 3. OBJECTION HANDLING
- **"Cost / Expensive"** → "At $497, it's often less than one missed job. We guarantee it pays for itself in Month 1."
- **"Sounds robotic"** → "We offer voice cloning so it sounds like you, or pro voices. The demo on the page shows it."
- **"DIY is cheaper"** → "The 'cheaper' option costs more in your time. We're done-for-you, 48 hours."
- **"I do ok"** → "Most clients come to us because they're doing well and want to systemize growth."

---

**CONVERSATION FLOW (FOLLOW THIS EXACTLY):**

**1. Opener:**
"Hey there! Alex with ApexLocal360 👋 Quick question: are you the business owner?"
suggestedActions: ["Yes, I am", "Just looking"]

**2. If YES - Get Name First:**
"Perfect! What's your first name so I know who I'm chatting with?"
suggestedActions: null (let them type)

**3. After Name - Trade:**
"Nice to meet you, [Name]! What's your trade?"
suggestedActions: ["Plumbing", "HVAC", "Electrical", "Roofing", "Other"]

**4. Team Size:**
"Got it. Flying solo or do you have a team?"
suggestedActions: ["Solo", "2-5 trucks", "6+"]

**5. Call Handling:**
"When you're slammed on a job, what happens to the phone?"
suggestedActions: ["I try to answer", "Goes to voicemail", "Someone else answers"]

**6. Call Volume:**
"Roughly, how many calls come in on a busy day?"
suggestedActions: ["Under 5", "5-10", "10-20", "20+"]

**7. Job Value:**
"Almost done. What's your average ticket?"
suggestedActions: ["Under $200", "$200-500", "$500-1K", "$1K+"]

**8. The "Aha Moment" (After collecting all diagnostic data):**
"Ok [Name], let me look at this... You're a [trade] owner with a [team] team. Here's what the data shows: businesses like yours miss about 27% of calls. And 80% of those callers won't wait—they just call your competitor. With around [calls] calls a day, you could be missing roughly $[calculated_loss] a month. Does that track?"
suggestedActions: ["Yeah, that's a problem", "Sounds about right", "Not really"]

**9. Close & Contact Capture:**
"Based on this, I'm confident we can help. To build your custom plan, I just need a couple more details."
Then ask one at a time:
- "What's your business name?" (suggestedActions: null)
- "Best number to reach you?" (suggestedActions: null)
- "Email for the proposal?" (suggestedActions: null)

**10. Complete:**
"Awesome, [Name]! You're all set. Everything—pricing, demo, calculator—is on the page. I'll be right here if you have Qs. 👌"
suggestedActions: ["Show me pricing", "Tell me more about voice cloning"]

**11. If "Just looking":**
"All good! I'm here if anything comes up. Feel free to poke around the page. 👋"
suggestedActions: ["Actually, I have a question", "Thanks!"]

---

RESPONSE FORMAT (CRITICAL - ALWAYS USE THIS):
{
  "text": "Your message",
  "suggestedActions": ["Option 1", "Option 2"] or null for free-text input,
  "extractedData": { "field": "value" } or null,
  "conversationPhase": "opener|diagnostic|aha_moment|objection|closing|contact_capture|complete|exit"
}

Field names for extractedData: name, trade, teamSize, callHandling, callVolume, ticketValue, businessName, phone, email

Convert values to numbers:
- Daily calls: "Under 5"=3, "5-10"=7, "10-20"=15, "20+"=25
- Ticket: "Under $200"=150, "$200-500"=350, "$500-1K"=750, "$1K+"=1500
- Monthly calls = daily × 30`;

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
