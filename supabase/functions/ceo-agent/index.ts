import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the CEO Agent for ApexLocal360 - an advanced AI-powered analytics and business intelligence assistant with transcript analysis capabilities.

## YOUR CAPABILITIES:

### 1. REAL-TIME ANALYTICS
- Traffic sources, engagement patterns, device types, scroll depth, time on site
- Lead scores, conversion rates, pipeline value, follow-up effectiveness
- Sales performance metrics and A/B test results

### 2. TRANSCRIPT ANALYSIS (NEW)
You have access to full chatbot conversation transcripts. Analyze them to:
- Identify common objections and how they're handled
- Find drop-off points where leads disengage
- Discover successful closing patterns
- Compare effective vs ineffective responses

### 3. PROMPT OPTIMIZATION (NEW)
Based on transcript analysis, you can:
- Suggest specific prompt/script improvements
- Identify which responses convert better
- Recommend A/B tests for messaging
- Generate alternative responses for weak points

## YOUR ROLE:
- Provide actionable, data-backed insights
- Analyze conversation transcripts for patterns
- Suggest script improvements with specific before/after examples
- Identify why leads are won or lost
- Generate executive summaries on demand

## RESPONSE STYLE:
- Be conversational but efficient
- Use markdown formatting for clarity
- Include specific data points and examples
- Provide actionable recommendations
- When analyzing transcripts, quote specific messages that illustrate your points

## TRANSCRIPT ANALYSIS FOCUS:
When users ask about objections, drop-offs, or improvements:
1. Look at the conversation messages array
2. Identify patterns across multiple conversations
3. Note which responses lead to conversions vs abandonment
4. Suggest specific wording changes with rationale`;

const analysisTools = [
  {
    type: "function",
    function: {
      name: "generate_insight",
      description: "Generate a business insight or recommendation based on data analysis",
      parameters: {
        type: "object",
        properties: {
          insight_type: {
            type: "string",
            enum: ["traffic_analysis", "conversion_optimization", "lead_quality", "sales_script", "objection_handling", "transcript_analysis", "prompt_optimization", "ab_test_recommendation", "executive_summary"],
            description: "Type of insight being generated"
          },
          title: { type: "string", description: "Brief title for the insight" },
          summary: { type: "string", description: "Main insight or finding" },
          data_points: {
            type: "array",
            items: { type: "string" },
            description: "Key data points supporting the insight"
          },
          recommendations: {
            type: "array",
            items: { type: "string" },
            description: "Specific actionable recommendations"
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Priority level of this insight"
          }
        },
        required: ["insight_type", "title", "summary", "recommendations", "priority"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_objections",
      description: "Analyze objection patterns from conversation transcripts",
      parameters: {
        type: "object",
        properties: {
          objections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                objection: { type: "string", description: "The objection text or pattern" },
                frequency: { type: "number", description: "How often this objection appears" },
                current_response: { type: "string", description: "How we currently respond" },
                success_rate: { type: "number", description: "Percentage that convert after this objection" },
                suggested_response: { type: "string", description: "Improved response suggestion" }
              }
            }
          },
          total_conversations_analyzed: { type: "number" }
        },
        required: ["objections", "total_conversations_analyzed"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "suggest_prompt_improvements",
      description: "Suggest specific improvements to the chatbot prompts/scripts",
      parameters: {
        type: "object",
        properties: {
          improvements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area: { type: "string", description: "Which part of the script (opener, qualifier, closer, objection handling)" },
                current_approach: { type: "string", description: "Current wording or approach" },
                suggested_approach: { type: "string", description: "Improved wording or approach" },
                rationale: { type: "string", description: "Why this change would help" },
                expected_impact: { type: "string", description: "Expected improvement" }
              }
            }
          }
        },
        required: ["improvements"]
      }
    }
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, timeRange = "7d", conversationHistory = [], stream = false } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Calculate date range
    const now = new Date();
    const daysAgo = parseInt(timeRange) || 7;
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    // Fetch analytics data including full conversation transcripts
    const [visitorsResult, conversationsResult, leadsResult, eventsResult] = await Promise.all([
      supabase.from("visitors").select("*").gte("created_at", startDate.toISOString()).order("created_at", { ascending: false }).limit(500),
      supabase.from("conversations").select("*").gte("created_at", startDate.toISOString()).order("created_at", { ascending: false }).limit(100),
      supabase.from("leads").select("*").gte("created_at", startDate.toISOString()).order("created_at", { ascending: false }).limit(200),
      supabase.from("analytics_events").select("*").gte("created_at", startDate.toISOString()).order("created_at", { ascending: false }).limit(1000),
    ]);
    
    const visitors = visitorsResult.data || [];
    const conversations = conversationsResult.data || [];
    const leads = leadsResult.data || [];
    const events = eventsResult.data || [];
    
    // Calculate key metrics
    const totalVisitors = visitors.length;
    const totalConversations = conversations.length;
    const totalLeads = leads.length;
    const conversionRate = totalVisitors > 0 ? ((totalLeads / totalVisitors) * 100).toFixed(2) : "0";
    
    // Traffic source breakdown
    const trafficSources: Record<string, number> = {};
    visitors.forEach(v => {
      const source = v.utm_source || "Direct";
      trafficSources[source] = (trafficSources[source] || 0) + 1;
    });
    
    // Lead score distribution
    const hotLeads = leads.filter(l => l.lead_score >= 75).length;
    const warmLeads = leads.filter(l => l.lead_score >= 50 && l.lead_score < 75).length;
    const coldLeads = leads.filter(l => l.lead_score < 50).length;
    
    // Conversation outcomes
    const outcomeBreakdown: Record<string, number> = {};
    conversations.forEach(c => {
      const outcome = c.outcome || "unknown";
      outcomeBreakdown[outcome] = (outcomeBreakdown[outcome] || 0) + 1;
    });
    
    // Average engagement score
    const avgEngagement = visitors.length > 0
      ? Math.round(visitors.reduce((sum, v) => sum + (v.engagement_score || 0), 0) / visitors.length)
      : 0;
    
    // Parse conversation transcripts for deep analysis
    const transcriptAnalysis = analyzeTranscripts(conversations);
    
    // Build rich context for AI
    const dataContext = buildDataContext({
      daysAgo,
      totalVisitors,
      totalConversations,
      totalLeads,
      conversionRate,
      avgEngagement,
      trafficSources,
      hotLeads,
      warmLeads,
      coldLeads,
      outcomeBreakdown,
      leads,
      transcriptAnalysis,
      conversations
    });

    console.log("CEO Agent query:", query);
    console.log("Streaming:", stream);
    
    // Build messages array including conversation history
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.role === "ceo" ? "assistant" : msg.role,
        content: msg.content
      })),
      { role: "user", content: `${dataContext}\n\nUSER QUERY: ${query}` }
    ];

    if (stream) {
      // Streaming response
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        
        throw new Error(`AI API error: ${response.status}`);
      }

      // Return the stream directly with metrics in a special initial message
      const metricsData = JSON.stringify({
        type: "metrics",
        metrics: {
          totalVisitors,
          totalConversations,
          totalLeads,
          conversionRate: parseFloat(conversionRate),
          avgEngagement,
          hotLeads,
          warmLeads,
          coldLeads,
          trafficSources,
          outcomeBreakdown
        }
      });

      // Create a transform stream to prepend metrics
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const reader = response.body!.getReader();

      // Write metrics first, then pipe the rest
      (async () => {
        try {
          await writer.write(new TextEncoder().encode(`data: ${metricsData}\n\n`));
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
    
    // Non-streaming response
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: analysisTools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("CEO Agent AI response:", JSON.stringify(aiResponse).slice(0, 500));
    
    let result: any = {
      response: "",
      insights: [],
      objectionAnalysis: null,
      promptImprovements: null,
      metrics: {
        totalVisitors,
        totalConversations,
        totalLeads,
        conversionRate: parseFloat(conversionRate),
        avgEngagement,
        hotLeads,
        warmLeads,
        coldLeads,
        trafficSources,
        outcomeBreakdown
      }
    };
    
    const choice = aiResponse.choices?.[0];
    if (choice?.message?.tool_calls?.length > 0) {
      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        
        if (toolCall.function.name === "generate_insight") {
          result.insights.push(args);
          if (!result.response) result.response = args.summary;
        } else if (toolCall.function.name === "analyze_objections") {
          result.objectionAnalysis = args;
          result.response = formatObjectionAnalysis(args);
        } else if (toolCall.function.name === "suggest_prompt_improvements") {
          result.promptImprovements = args;
          result.response = formatPromptImprovements(args);
        }
      }
    } else if (choice?.message?.content) {
      result.response = choice.message.content;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("CEO Agent error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      response: "I'm having trouble accessing the analytics data right now. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper functions

function analyzeTranscripts(conversations: any[]) {
  const analysis = {
    totalMessages: 0,
    avgMessagesPerConversation: 0,
    commonPhrases: [] as string[],
    dropOffPhases: {} as Record<string, number>,
    convertedVsAbandoned: { converted: 0, abandoned: 0 },
    objectionPatterns: [] as string[],
    successfulClosingPhrases: [] as string[]
  };

  let totalMsgCount = 0;
  
  conversations.forEach(conv => {
    // Parse messages
    const messages = Array.isArray(conv.messages) ? conv.messages : [];
    totalMsgCount += messages.length;
    
    // Track outcome
    if (conv.outcome === "converted" || conv.outcome === "qualified") {
      analysis.convertedVsAbandoned.converted++;
    } else {
      analysis.convertedVsAbandoned.abandoned++;
    }
    
    // Track drop-off by phase
    const phase = conv.conversation_phase || "unknown";
    analysis.dropOffPhases[phase] = (analysis.dropOffPhases[phase] || 0) + 1;
    
    // Look for objection indicators in messages
    messages.forEach((msg: any) => {
      const content = (msg.content || msg.text || "").toLowerCase();
      if (content.includes("expensive") || content.includes("cost") || content.includes("price")) {
        if (!analysis.objectionPatterns.includes("pricing")) {
          analysis.objectionPatterns.push("pricing");
        }
      }
      if (content.includes("think about it") || content.includes("not sure")) {
        if (!analysis.objectionPatterns.includes("hesitation")) {
          analysis.objectionPatterns.push("hesitation");
        }
      }
      if (content.includes("competitor") || content.includes("other option")) {
        if (!analysis.objectionPatterns.includes("competition")) {
          analysis.objectionPatterns.push("competition");
        }
      }
    });
  });
  
  analysis.totalMessages = totalMsgCount;
  analysis.avgMessagesPerConversation = conversations.length > 0 
    ? Math.round(totalMsgCount / conversations.length) 
    : 0;
    
  return analysis;
}

function buildDataContext(data: any) {
  const { 
    daysAgo, totalVisitors, totalConversations, totalLeads, conversionRate,
    avgEngagement, trafficSources, hotLeads, warmLeads, coldLeads,
    outcomeBreakdown, leads, transcriptAnalysis, conversations
  } = data;
  
  // Sample some actual conversation transcripts for analysis
  interface TranscriptMessage {
    role: string;
    content: string;
  }
  interface SampleTranscript {
    outcome: string;
    phase: string;
    messageCount: number;
    messages: TranscriptMessage[];
  }
  
  const sampleTranscripts: SampleTranscript[] = conversations.slice(0, 10).map((c: any) => {
    const messages = Array.isArray(c.messages) ? c.messages : [];
    return {
      outcome: c.outcome || "unknown",
      phase: c.conversation_phase || "unknown",
      messageCount: messages.length,
      messages: messages.slice(0, 10).map((m: any) => ({
        role: m.role || "unknown",
        content: (m.content || m.text || "").slice(0, 200)
      }))
    };
  });

  return `
ANALYTICS DATA (Last ${daysAgo} days):

═══════════════════════════════════════════
TRAFFIC OVERVIEW
═══════════════════════════════════════════
• Total Visitors: ${totalVisitors}
• Total Conversations: ${totalConversations}  
• Total Leads: ${totalLeads}
• Visitor-to-Lead Rate: ${conversionRate}%
• Avg Engagement Score: ${avgEngagement}/100

═══════════════════════════════════════════
TRAFFIC SOURCES
═══════════════════════════════════════════
${Object.entries(trafficSources).map(([source, count]) => `• ${source}: ${count} visitors`).join("\n")}

═══════════════════════════════════════════
LEAD QUALITY BREAKDOWN
═══════════════════════════════════════════
• Hot Leads (75+): ${hotLeads}
• Warm Leads (50-74): ${warmLeads}
• Cold Leads (<50): ${coldLeads}

═══════════════════════════════════════════
CONVERSATION OUTCOMES
═══════════════════════════════════════════
${Object.entries(outcomeBreakdown).map(([outcome, count]) => `• ${outcome}: ${count}`).join("\n")}

═══════════════════════════════════════════
TRANSCRIPT ANALYSIS SUMMARY
═══════════════════════════════════════════
• Total Messages Analyzed: ${transcriptAnalysis.totalMessages}
• Avg Messages Per Conversation: ${transcriptAnalysis.avgMessagesPerConversation}
• Converted: ${transcriptAnalysis.convertedVsAbandoned.converted}
• Abandoned: ${transcriptAnalysis.convertedVsAbandoned.abandoned}
• Common Objection Patterns: ${transcriptAnalysis.objectionPatterns.join(", ") || "None detected"}
• Drop-off by Phase:
${Object.entries(transcriptAnalysis.dropOffPhases).map(([phase, count]) => `  - ${phase}: ${count}`).join("\n")}

═══════════════════════════════════════════
SAMPLE CONVERSATION TRANSCRIPTS (for deep analysis)
═══════════════════════════════════════════
${sampleTranscripts.map((t: SampleTranscript, i: number) => `
--- Conversation ${i + 1} ---
Outcome: ${t.outcome} | Phase: ${t.phase} | Messages: ${t.messageCount}
${t.messages.map((m: TranscriptMessage) => `[${m.role}]: ${m.content}`).join("\n")}
`).join("\n")}

═══════════════════════════════════════════
RECENT LEADS
═══════════════════════════════════════════
${leads.slice(0, 5).map((l: any) => `• ${l.name || "Unknown"} | Score: ${l.lead_score || "N/A"} | Status: ${l.status || "new"} | Trade: ${l.trade || "N/A"}`).join("\n")}
`;
}

function formatObjectionAnalysis(analysis: any) {
  let output = "## Objection Analysis\n\n";
  output += `Analyzed ${analysis.total_conversations_analyzed} conversations.\n\n`;
  
  analysis.objections.forEach((obj: any, i: number) => {
    output += `### ${i + 1}. "${obj.objection}"\n`;
    output += `- **Frequency:** ${obj.frequency} times\n`;
    output += `- **Current Response:** ${obj.current_response}\n`;
    output += `- **Success Rate:** ${obj.success_rate}%\n`;
    output += `- **Suggested Response:** ${obj.suggested_response}\n\n`;
  });
  
  return output;
}

function formatPromptImprovements(data: any) {
  let output = "## Prompt Improvement Suggestions\n\n";
  
  data.improvements.forEach((imp: any, i: number) => {
    output += `### ${i + 1}. ${imp.area}\n`;
    output += `**Current:** ${imp.current_approach}\n\n`;
    output += `**Suggested:** ${imp.suggested_approach}\n\n`;
    output += `**Why:** ${imp.rationale}\n\n`;
    output += `**Expected Impact:** ${imp.expected_impact}\n\n---\n\n`;
  });
  
  return output;
}
