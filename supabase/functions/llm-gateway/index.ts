import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LLMRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}

interface LLMConfig {
  id: string;
  provider: string;
  model_name: string;
  api_endpoint: string;
  secret_key_name: string;
  is_primary: boolean;
  priority: number;
  failure_count: number;
}

const MAX_RETRIES = 3;
const FAILURE_THRESHOLD = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const requestBody: LLMRequest = await req.json();
    const { messages, model, stream = false, max_tokens, temperature } = requestBody;

    // Get available LLM configurations ordered by priority
    const { data: configs, error: configError } = await supabase
      .from('llm_configuration')
      .select('*')
      .eq('is_active', true)
      .lt('failure_count', FAILURE_THRESHOLD)
      .order('priority', { ascending: true });

    if (configError || !configs?.length) {
      console.error('No LLM configurations available:', configError);
      return new Response(JSON.stringify({ error: 'No LLM providers available' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try each provider in order of priority
    let lastError: Error | null = null;
    
    for (const config of configs as LLMConfig[]) {
      try {
        const result = await callLLM(config, messages, model, stream, max_tokens, temperature);
        
        // Reset failure count on success
        if (config.failure_count > 0) {
          await supabase
            .from('llm_configuration')
            .update({ 
              failure_count: 0, 
              health_status: 'healthy',
              last_health_check: new Date().toISOString()
            })
            .eq('id', config.id);
        }

        // Log successful call
        await logAuditEntry(supabase, {
          agent_name: 'llm-gateway',
          action_type: 'llm_call',
          entity_type: 'llm_provider',
          entity_id: config.id,
          description: `LLM call via ${config.provider}/${config.model_name}`,
          duration_ms: Date.now() - startTime,
          success: true,
        });

        if (stream && result instanceof Response) {
          return new Response(result.body, {
            headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
          });
        }

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error(`LLM call failed for ${config.provider}:`, error);
        lastError = error as Error;

        // Increment failure count
        await supabase
          .from('llm_configuration')
          .update({ 
            failure_count: config.failure_count + 1,
            health_status: config.failure_count + 1 >= FAILURE_THRESHOLD ? 'unhealthy' : 'degraded',
            last_health_check: new Date().toISOString()
          })
          .eq('id', config.id);

        // Continue to next provider
        continue;
      }
    }

    // All providers failed
    await logAuditEntry(supabase, {
      agent_name: 'llm-gateway',
      action_type: 'llm_call',
      description: 'All LLM providers failed',
      duration_ms: Date.now() - startTime,
      success: false,
      error_message: lastError?.message,
    });

    return new Response(JSON.stringify({ 
      error: 'All LLM providers failed', 
      last_error: lastError?.message 
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('LLM Gateway error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function callLLM(
  config: LLMConfig,
  messages: Array<{ role: string; content: string }>,
  requestedModel?: string,
  stream: boolean = false,
  max_tokens?: number,
  temperature?: number
): Promise<Response | Record<string, unknown>> {
  const apiKey = Deno.env.get(config.secret_key_name);
  
  if (!apiKey) {
    throw new Error(`API key not found for ${config.secret_key_name}`);
  }

  const modelToUse = requestedModel || config.model_name;
  
  const requestBody: Record<string, unknown> = {
    model: modelToUse,
    messages,
    stream,
  };

  // Handle different API parameter conventions
  if (config.provider === 'openai' && modelToUse.includes('gpt-5')) {
    // GPT-5 uses max_completion_tokens and doesn't support temperature
    if (max_tokens) requestBody.max_completion_tokens = max_tokens;
  } else {
    if (max_tokens) requestBody.max_tokens = max_tokens;
    if (temperature !== undefined) requestBody.temperature = temperature;
  }

  const response = await fetch(config.api_endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  if (stream) {
    return response;
  }

  return await response.json();
}

async function logAuditEntry(
  supabase: any,
  entry: Record<string, unknown>
) {
  try {
    await supabase.from('platform_audit_log').insert({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log audit entry:', error);
  }
}
