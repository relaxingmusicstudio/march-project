import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMITS: Record<string, { requests: number; windowMs: number }> = {
  'lovable-ai': { requests: 60, windowMs: 60000 },
  'twilio': { requests: 100, windowMs: 60000 },
  'resend': { requests: 50, windowMs: 60000 },
  'elevenlabs': { requests: 30, windowMs: 60000 },
  'default': { requests: 100, windowMs: 60000 }
};

// In-memory rate limit tracking (resets on cold start)
const rateLimitCache: Map<string, { count: number; resetAt: number }> = new Map();

interface GatewayRequest {
  service: 'lovable-ai' | 'twilio' | 'resend' | 'elevenlabs' | 'vapi' | 'did';
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

function checkRateLimit(service: string): { allowed: boolean; remaining: number; resetIn: number } {
  const config = RATE_LIMITS[service] || RATE_LIMITS['default'];
  const key = `rate:${service}`;
  const now = Date.now();
  
  let record = rateLimitCache.get(key);
  
  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + config.windowMs };
    rateLimitCache.set(key, record);
  }
  
  record.count++;
  const remaining = Math.max(0, config.requests - record.count);
  const resetIn = Math.max(0, record.resetAt - now);
  
  return {
    allowed: record.count <= config.requests,
    remaining,
    resetIn
  };
}

async function logApiCall(
  supabase: any,
  service: string,
  endpoint: string,
  method: string,
  startTime: number,
  status: number,
  error?: string,
  costCents?: number
) {
  const responseTimeMs = Date.now() - startTime;
  
  try {
    await supabase.from('api_logs').insert({
      service,
      endpoint,
      method,
      response_status: status,
      response_time_ms: responseTimeMs,
      cost_cents: costCents || 0,
      error_message: error
    });
  } catch (e) {
    console.error('Failed to log API call:', e);
  }
}

function getServiceConfig(service: string): { baseUrl: string; authHeader: string; apiKey: string | undefined } {
  switch (service) {
    case 'lovable-ai':
      return {
        baseUrl: 'https://ai.gateway.lovable.dev/v1',
        authHeader: 'Authorization',
        apiKey: Deno.env.get('LOVABLE_API_KEY')
      };
    case 'twilio':
      // Twilio uses basic auth
      return {
        baseUrl: 'https://api.twilio.com/2010-04-01',
        authHeader: 'Authorization',
        apiKey: undefined // Handled separately
      };
    case 'resend':
      return {
        baseUrl: 'https://api.resend.com',
        authHeader: 'Authorization',
        apiKey: Deno.env.get('RESEND_API_KEY')
      };
    case 'elevenlabs':
      return {
        baseUrl: 'https://api.elevenlabs.io/v1',
        authHeader: 'xi-api-key',
        apiKey: Deno.env.get('ELEVENLABS_API_KEY')
      };
    case 'vapi':
      return {
        baseUrl: 'https://api.vapi.ai',
        authHeader: 'Authorization',
        apiKey: Deno.env.get('VAPI_API_KEY')
      };
    case 'did':
      return {
        baseUrl: 'https://api.d-id.com',
        authHeader: 'Authorization',
        apiKey: Deno.env.get('DID_API_KEY')
      };
    default:
      throw new Error(`Unknown service: ${service}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { service, endpoint, method = 'POST', body, headers: customHeaders }: GatewayRequest = await req.json();

    if (!service || !endpoint) {
      return new Response(JSON.stringify({ error: 'Missing service or endpoint' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit
    const rateLimit = checkRateLimit(service);
    if (!rateLimit.allowed) {
      await logApiCall(supabase, service, endpoint, method, startTime, 429, 'Rate limit exceeded');
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(rateLimit.resetIn / 1000)
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'Retry-After': Math.ceil(rateLimit.resetIn / 1000).toString()
        },
      });
    }

    const config = getServiceConfig(service);
    
    if (!config.apiKey && service !== 'twilio') {
      await logApiCall(supabase, service, endpoint, method, startTime, 500, 'API key not configured');
      return new Response(JSON.stringify({ error: `${service} API key not configured` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build request headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders
    };

    if (config.apiKey) {
      if (config.authHeader === 'Authorization') {
        requestHeaders['Authorization'] = `Bearer ${config.apiKey}`;
      } else {
        requestHeaders[config.authHeader] = config.apiKey;
      }
    }

    const url = `${config.baseUrl}${endpoint}`;
    console.log(`API Gateway: ${method} ${service}${endpoint}`);

    // Make the request with retry logic
    let response: Response | null = null;
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined
        });

        // Don't retry on client errors
        if (response.status < 500) break;
        
        // Retry on server errors
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, attempt * 1000));
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, attempt * 1000));
        }
      }
    }

    if (!response) {
      await logApiCall(supabase, service, endpoint, method, startTime, 503, lastError?.message);
      return new Response(JSON.stringify({ 
        error: 'Service unavailable after retries',
        details: lastError?.message
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Estimate cost (simplified)
    let costCents = 0;
    if (service === 'lovable-ai') {
      costCents = 1; // ~$0.01 per AI call estimate
    } else if (service === 'twilio') {
      costCents = 1; // ~$0.01 per SMS
    } else if (service === 'elevenlabs') {
      costCents = 5; // ~$0.05 per voice generation
    }

    await logApiCall(supabase, service, endpoint, method, startTime, response.status, undefined, costCents);

    // Return the response
    const responseBody = await response.text();
    
    return new Response(responseBody, {
      status: response.status,
      headers: { 
        ...corsHeaders, 
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-Response-Time': `${Date.now() - startTime}ms`
      },
    });

  } catch (error) {
    console.error('API Gateway error:', error);
    await logApiCall(supabase, 'unknown', '/error', 'POST', startTime, 500, error instanceof Error ? error.message : 'Unknown error');
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Gateway error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
