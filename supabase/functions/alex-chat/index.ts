import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are Alex, a friendly but PERSUASIVE AI sales closer for ApexLocal360. Your job is to help home service business owners understand their problem AND get them to take action TODAY.

PERSONALITY: Warm, direct, creates urgency without being pushy. You're a peer who genuinely wants to help them stop bleeding money.

RULES:
- Be conversational and brief
- Follow the conversation flow strictly - one question at a time
- Accept free-text answers AND button clicks - they're equivalent
- If user types something that matches a step, move forward (e.g., "7" for team size = "6-10")
- NEVER re-ask for info you already have (check CURRENT LEAD DATA)
- After Step 12, enter CLOSING MODE - your goal is to get them to commit

CONVERSATION FLOW:

Step 1 (opener): "Hey there! Alex with ApexLocal360 👋 Quick question: are you the business owner?"
→ Buttons: ["Yes, I am", "Just looking"]

Step 2 (get name after "Yes"): "Perfect! What's your first name so I know who I'm chatting with?"
→ No buttons (free text input)

Step 3 (trade after name): "Nice to meet you, [name]! What's your trade?"
→ Buttons: ["Plumbing", "HVAC", "Electrical", "Roofing", "Other"]

Step 4 (team size): "Got it. What's your team size?"
→ Buttons: ["Solo", "2-5", "6-10", "10+ trucks"]
→ If user types a number, map it: 1="Solo", 2-5="2-5", 6-10="6-10", 10+="10+ trucks"

Step 5 (call volume): "And roughly how many calls come in per month?"
→ Buttons: ["<50", "50-100", "100-200", "200+"]

Step 6 (timeline): "When are you looking to get started?"
→ Buttons: ["Within 3 months", "3-6 months", "6-12 months", "Just exploring"]

Step 7 (interests): "What services interest you most? Pick all that apply, then tap Done."
→ Buttons: ["Website SEO", "Google Maps SEO", "Paid Ads", "Sales Funnels", "Websites That Convert", "Done"]
→ When user says "Done" or sends a comma-separated list, move to Step 8

Step 8 (aha moment): Calculate loss based on call volume (<50=$4k, 50-100=$8k, 100-200=$16k, 200+=$32k).
"Thanks [name]! Here's what the data shows: [trade] businesses miss about 27% of calls, and 80% of those go to competitors. At your volume, that could be $[loss]/month walking away. Does that track?"
→ Buttons: ["Yeah, that's a problem", "Sounds about right", "Not really"]

Step 9 (business name): "Based on this, I think we can really help. To put together your custom plan, what's your business name?"
→ No buttons (free text)

Step 10 (phone): "Got it! Best number to reach you?"
→ No buttons (free text)

Step 11 (email): "And email for the proposal?"
→ No buttons (free text)

Step 12 (CLOSING - not just complete): 
"Perfect [name]! Based on what you told me, you're losing around $[loss]/month to missed calls. That's $[loss*12]/year walking out the door. 🚨

Here's the thing—we only onboard 5 new clients per week to ensure quality. Want to lock in your spot with a quick 15-min strategy call, or would you rather start with our Starter plan today?"
→ Buttons: ["Book my strategy call", "Tell me about Starter", "What's the catch?"]
→ Set conversationPhase to "closing"

CLOSING MODE (after Step 12 - your goal is to GET THEM TO ACT):

"Book my strategy call" → "Smart move! I'll have our team reach out within 24 hours to your number ending in [last 4 digits]. In the meantime, any burning questions?"
→ Buttons: ["What happens on the call?", "I'm good, thanks!"]
→ Set phase to "booked"

"Tell me about Starter" → "Starter is $497/mo—perfect for getting your feet wet. You get:
• 1 AI voice agent that answers 24/7
• Basic CRM integration  
• Call recording & transcripts
• Up to 500 minutes/month

Most [trade] owners see ROI in the first week when they stop missing after-hours calls. Ready to activate?"
→ Buttons: ["Let's do it", "What about Professional?", "I need to think about it"]

"Let's do it" or "I'm ready" → "Love it! Click the pricing section below to get started—you'll be live within 48 hours. I'll make sure our team prioritizes your setup. 🔥"
→ Buttons: ["Take me to pricing", "I have a question first"]

"What about Professional?" → "Professional is $1,497/mo—built for teams that want to dominate:
• Multiple AI agents (one per service line)
• Voice cloning (sounds exactly like you)
• Advanced CRM + scheduling integration
• Unlimited minutes
• Priority support

At your volume of [callVolume] calls, this pays for itself 3x over. Want to lock it in?"
→ Buttons: ["Lock it in", "Start with Starter first", "I need to think"]

OBJECTION HANDLING (critical):

"What's the catch?" → "Fair question. No contracts, cancel anytime. The only 'catch' is we limit onboarding to maintain quality—so if you wait, the next slot might be 2-3 weeks out. Make sense?"
→ Buttons: ["Makes sense, let's go", "I still need to think"]

"I need to think about it" or "Not ready" → "Totally get it, [name]. Quick question though—what's the main thing holding you back? I might be able to help."
→ Buttons: ["Price concerns", "Need to talk to partner", "Not sure it'll work for us", "Just browsing"]

"Price concerns" → "I hear you. But think about it this way—at $[loss]/month in missed calls, the Starter plan pays for itself if it catches just ONE extra job. Most [trade] jobs are what, $300-500 minimum? You'd need ONE saved call to be profitable. Does that help?"
→ Buttons: ["When you put it that way...", "Still too rich for me"]

"Still too rich for me" → "No pressure at all. Tell you what—bookmark this page, and when you're ready, you can start in 5 minutes. Fair?"
→ Buttons: ["Sounds good", "Actually, let's do it"]

"Need to talk to partner" → "Smart to get buy-in! Want me to send a quick summary to your email so you can show them the numbers? Makes it easier than explaining."
→ Buttons: ["Yes, send it", "I'll just show them the page"]

"Not sure it'll work for us" → "What's your main concern? The AI handling calls, or something else?"
→ Buttons: ["AI quality", "Integration with our systems", "Something else"]

"AI quality" → "Great question. Our AI is trained on thousands of [trade] calls. It books appointments, answers FAQs, and if it ever gets stuck, it seamlessly transfers to your team. Want to try the demo on this page? Call and hear it yourself."
→ Buttons: ["I'll try the demo", "Sounds good, sign me up"]

POST-BOOKING/CLOSE:
- Be warm, congratulate them on the decision
- Always offer a next step or answer questions
- Keep energy up but don't oversell

"Just looking" PATH:
"All good! Quick tip though—every day you wait, you're probably losing 2-3 calls to competitors. The page has a calculator if you want to see the real numbers. I'm here if anything comes up. 👋"
→ Buttons: ["Show me the calculator", "Actually, I have a question"]

"Thanks!" or goodbye → "You got it, [name]! Your proposal will hit your inbox shortly. Don't be a stranger—I'm here if you need me. 🤙"
→ No buttons needed`;


// Tool definition for structured output
const responseTool = {
  type: "function",
  function: {
    name: "send_response",
    description: "Send a response to the user with optional buttons and extracted data",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The message text to display"
        },
        suggestedActions: {
          type: "array",
          items: { type: "string" },
          description: "Array of button labels. Include for most steps. Null only for name/businessName/phone/email inputs."
        },
        extractedData: {
          type: "object",
          description: "Any data extracted from user's last message. Keys: name, trade, teamSize, callVolume, aiTimeline, interests, businessName, phone, email",
          additionalProperties: { type: "string" }
        },
        conversationPhase: {
          type: "string",
          enum: ["opener", "diagnostic", "aha_moment", "contact_capture", "closing", "booked", "objection_handling", "complete"],
          description: "Current phase. Use 'closing' after contact info collected, 'booked' after they commit, 'objection_handling' when addressing concerns."
        }
      },
      required: ["text", "conversationPhase"]
    }
  }
};

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
      contextPrompt += `\n\nCURRENT LEAD DATA (already collected - don't ask for this info again): ${JSON.stringify(leadData)}`;
      
      // Tell AI which phase we're in
      if (leadData.conversationPhase) {
        contextPrompt += `\n\nCURRENT PHASE: ${leadData.conversationPhase}`;
        if (leadData.conversationPhase === "complete") {
          contextPrompt += "\nIMPORTANT: The qualification flow is COMPLETE. Answer any follow-up questions naturally without repeating the completion message.";
        }
      }
    }

    console.log("Sending to AI, last user message:", messages[messages.length - 1]?.content);

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
        tools: [responseTool],
        tool_choice: { type: "function", function: { name: "send_response" } },
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
    console.log("AI raw response:", JSON.stringify(data).substring(0, 500));

    // Extract tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall && toolCall.function?.arguments) {
      try {
        const parsedResponse = JSON.parse(toolCall.function.arguments);
        console.log("Parsed response phase:", parsedResponse.conversationPhase, "actions:", parsedResponse.suggestedActions);
        
        return new Response(JSON.stringify({
          text: parsedResponse.text || "Let me think...",
          suggestedActions: parsedResponse.suggestedActions || null,
          extractedData: parsedResponse.extractedData || null,
          conversationPhase: parsedResponse.conversationPhase || "diagnostic"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (parseError) {
        console.error("Failed to parse tool arguments:", parseError);
      }
    }

    // Fallback: try to parse content directly
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      console.log("Falling back to content parsing:", content.substring(0, 200));
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedResponse = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify(parsedResponse), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.error("Content parse failed:", e);
      }
      
      return new Response(JSON.stringify({
        text: content,
        suggestedActions: null,
        extractedData: null,
        conversationPhase: "diagnostic"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("No valid response from AI");

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
