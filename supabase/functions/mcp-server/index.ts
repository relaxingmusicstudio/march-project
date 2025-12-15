import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MCP Server for Claude Desktop Integration
// Exposes business data and tools for CEO workflow automation

interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

// Define available tools for Claude
const TOOLS: MCPTool[] = [
  {
    name: "get_recent_patterns",
    description: "Get detected patterns from user behavior and sales performance over the last N days",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to analyze (default: 7)" },
        pattern_type: { type: "string", enum: ["all", "user_behavior", "sales", "objection", "conversion"], description: "Type of patterns to retrieve" }
      }
    }
  },
  {
    name: "get_learning_history",
    description: "Get the AI learning history showing what the system has learned from successful interactions",
    inputSchema: {
      type: "object",
      properties: {
        agent_type: { type: "string", description: "Filter by agent type (e.g., 'ceo-agent', 'alex-chat')" },
        limit: { type: "number", description: "Number of entries to return (default: 20)" },
        min_success_score: { type: "number", description: "Minimum success score (0-1)" }
      }
    }
  },
  {
    name: "get_ceo_decisions",
    description: "Get recorded CEO decisions for analysis and pattern learning",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back" },
        decision_type: { type: "string", description: "Filter by decision type" }
      }
    }
  },
  {
    name: "get_business_metrics",
    description: "Get key business metrics including leads, conversions, and revenue data",
    inputSchema: {
      type: "object",
      properties: {
        timeRange: { type: "string", enum: ["1d", "7d", "30d", "90d"], description: "Time range for metrics" }
      }
    }
  },
  {
    name: "search_conversations",
    description: "Search through conversation transcripts for specific topics or objections",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results to return" }
      },
      required: ["query"]
    }
  },
  {
    name: "get_lead_pipeline",
    description: "Get current lead pipeline status and priority leads",
    inputSchema: {
      type: "object",
      properties: {
        status_filter: { type: "string", enum: ["all", "new", "qualified", "proposal_sent", "hot"], description: "Filter by status" }
      }
    }
  },
  {
    name: "analyze_objections",
    description: "Get analysis of common objections and how they're being handled",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Days to analyze" }
      }
    }
  },
  {
    name: "get_agent_performance",
    description: "Get AI agent performance metrics including accuracy and response times",
    inputSchema: {
      type: "object",
      properties: {
        agent_type: { type: "string", description: "Specific agent to analyze" },
        days: { type: "number", description: "Days to look back" }
      }
    }
  }
];

// Define available resources
const RESOURCES: MCPResource[] = [
  {
    uri: "ceo://decisions/recent",
    name: "Recent CEO Decisions",
    description: "The last 50 recorded CEO decisions and their rationale",
    mimeType: "application/json"
  },
  {
    uri: "ceo://patterns/active",
    name: "Active Patterns",
    description: "Currently detected patterns in user behavior and sales",
    mimeType: "application/json"
  },
  {
    uri: "ceo://knowledge/base",
    name: "Business Knowledge Base",
    description: "Stored business knowledge and best practices",
    mimeType: "application/json"
  },
  {
    uri: "ceo://prompts/current",
    name: "Current Prompts",
    description: "Current chatbot prompts and scripts",
    mimeType: "application/json"
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const request: MCPRequest = await req.json();
    console.log(`[MCP Server] Method: ${request.method}`, request.params);

    switch (request.method) {
      case 'initialize':
        return jsonResponse({
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: false, listChanged: true }
          },
          serverInfo: {
            name: "ceo-in-a-box-mcp",
            version: "1.0.0",
            description: "MCP Server for AI CEO in a Box - Access business data and tools"
          }
        });

      case 'tools/list':
        return jsonResponse({ tools: TOOLS });

      case 'resources/list':
        return jsonResponse({ resources: RESOURCES });

      case 'tools/call':
        const result = await executeTool(supabase, request.params as { name: string; arguments?: Record<string, unknown> });
        return jsonResponse({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });

      case 'resources/read':
        const resourceData = await readResource(supabase, request.params as { uri: string });
        return jsonResponse({ contents: [{ uri: request.params?.uri, mimeType: "application/json", text: JSON.stringify(resourceData, null, 2) }] });

      default:
        return jsonResponse({ error: { code: -32601, message: `Unknown method: ${request.method}` } }, 400);
    }
  } catch (error) {
    console.error('[MCP Server] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: { code: -32603, message } }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function executeTool(supabase: any, params: { name: string; arguments?: Record<string, unknown> }) {
  const { name, arguments: args = {} } = params;
  const now = new Date();

  switch (name) {
    case 'get_recent_patterns': {
      const days = (args.days as number) || 7;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      let query = supabase
        .from('user_patterns')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('confidence_score', { ascending: false })
        .limit(50);
      
      if (args.pattern_type && args.pattern_type !== 'all') {
        query = query.eq('pattern_type', args.pattern_type);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return { patterns: data, count: data?.length || 0, period_days: days };
    }

    case 'get_learning_history': {
      const limit = (args.limit as number) || 20;
      
      let query = supabase
        .from('agent_memories')
        .select('*')
        .order('success_score', { ascending: false })
        .limit(limit);
      
      if (args.agent_type) {
        query = query.eq('agent_type', args.agent_type);
      }
      if (args.min_success_score) {
        query = query.gte('success_score', args.min_success_score);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return { memories: data, count: data?.length || 0 };
    }

    case 'get_ceo_decisions': {
      const days = (args.days as number) || 30;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      let query = supabase
        .from('agent_memories')
        .select('*')
        .eq('agent_type', 'ceo-training')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      return { decisions: data, count: data?.length || 0, period_days: days };
    }

    case 'get_business_metrics': {
      const timeRange = (args.timeRange as string) || '7d';
      const days = parseInt(timeRange) || 7;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      const [leads, conversations, visitors] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact' }).gte('created_at', startDate.toISOString()),
        supabase.from('conversations').select('*', { count: 'exact' }).gte('created_at', startDate.toISOString()),
        supabase.from('visitors').select('*', { count: 'exact' }).gte('created_at', startDate.toISOString())
      ]);
      
      return {
        leads: { count: leads.count || 0, data: leads.data?.slice(0, 10) },
        conversations: { count: conversations.count || 0 },
        visitors: { count: visitors.count || 0 },
        period: timeRange
      };
    }

    case 'search_conversations': {
      const query = args.query as string;
      const limit = (args.limit as number) || 20;
      
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`transcript.ilike.%${query}%,summary.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return { results: data, count: data?.length || 0, query };
    }

    case 'get_lead_pipeline': {
      let query = supabase
        .from('leads')
        .select('*')
        .order('score', { ascending: false })
        .limit(50);
      
      if (args.status_filter && args.status_filter !== 'all') {
        if (args.status_filter === 'hot') {
          query = query.gte('score', 70);
        } else {
          query = query.eq('status', args.status_filter);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Group by status
      const pipeline = (data || []).reduce((acc: Record<string, any[]>, lead: any) => {
        const status = lead.status || 'new';
        if (!acc[status]) acc[status] = [];
        acc[status].push(lead);
        return acc;
      }, {});
      
      return { pipeline, total: data?.length || 0 };
    }

    case 'analyze_objections': {
      const days = (args.days as number) || 30;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      const { data, error } = await supabase
        .from('conversations')
        .select('transcript, outcome')
        .gte('created_at', startDate.toISOString())
        .not('transcript', 'is', null);
      
      if (error) throw error;
      
      // Simple objection extraction
      const objectionKeywords = ['price', 'cost', 'expensive', 'budget', 'competitor', 'think about it', 'not ready', 'call back'];
      const objectionCounts: Record<string, number> = {};
      
      (data || []).forEach((conv: any) => {
        const transcript = (conv.transcript || '').toLowerCase();
        objectionKeywords.forEach(keyword => {
          if (transcript.includes(keyword)) {
            objectionCounts[keyword] = (objectionCounts[keyword] || 0) + 1;
          }
        });
      });
      
      return { 
        objections: Object.entries(objectionCounts).map(([keyword, count]) => ({ keyword, count })).sort((a, b) => b.count - a.count),
        conversations_analyzed: data?.length || 0,
        period_days: days
      };
    }

    case 'get_agent_performance': {
      const days = (args.days as number) || 7;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      let query = supabase
        .from('agent_performance')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0]);
      
      if (args.agent_type) {
        query = query.eq('agent_type', args.agent_type);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return { performance: data, period_days: days };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function readResource(supabase: any, params: { uri: string }) {
  const { uri } = params;

  switch (uri) {
    case 'ceo://decisions/recent': {
      const { data } = await supabase
        .from('agent_memories')
        .select('*')
        .eq('agent_type', 'ceo-training')
        .order('created_at', { ascending: false })
        .limit(50);
      return { decisions: data };
    }

    case 'ceo://patterns/active': {
      const { data } = await supabase
        .from('user_patterns')
        .select('*')
        .eq('is_active', true)
        .order('confidence_score', { ascending: false })
        .limit(100);
      return { patterns: data };
    }

    case 'ceo://knowledge/base': {
      const { data } = await supabase
        .from('business_knowledge')
        .select('*')
        .eq('is_ai_accessible', true)
        .order('priority', { ascending: false });
      return { knowledge: data };
    }

    case 'ceo://prompts/current': {
      const { data } = await supabase
        .from('chatbot_prompts')
        .select('*')
        .eq('is_active', true);
      return { prompts: data };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}
