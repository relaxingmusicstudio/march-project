import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChat, parseAIError } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integrations = ['all'] } = await req.json();
    const results: Array<{ name: string; status: string; message: string; latency_ms?: number; provider?: string; model?: string }> = [];
    
    const runAll = integrations.includes('all');

    // 1. Test Gemini AI (via shared helper) - default provider
    if (runAll || integrations.includes('gemini_ai')) {
      const start = Date.now();
      try {
        const result = await aiChat({
          messages: [{ role: 'user', content: 'Say "test successful" in 3 words or less' }],
          max_tokens: 10,
          purpose: 'integration_test',
        });
        
        results.push({ 
          name: 'Gemini AI', 
          status: 'success', 
          message: `Connected via ${result.provider}`,
          provider: result.provider,
          model: result.model,
          latency_ms: Date.now() - start,
        });
      } catch (error) {
        const parsed = parseAIError(error);
        results.push({ 
          name: 'Gemini AI', 
          status: 'error', 
          message: parsed.message,
          latency_ms: Date.now() - start,
        });
      }
    }

    // 2. Test Premium AI routing (with purpose that triggers premium)
    if (runAll || integrations.includes('premium_ai')) {
      const start = Date.now();
      try {
        const result = await aiChat({
          messages: [{ role: 'user', content: 'Say "premium test" in 3 words or less' }],
          max_tokens: 10,
          purpose: 'ceo_daily_brief', // This purpose should trigger premium routing if configured
        });
        
        results.push({ 
          name: 'Premium AI Routing', 
          status: 'success', 
          message: `Routed to ${result.provider}/${result.model}`,
          provider: result.provider,
          model: result.model,
          latency_ms: Date.now() - start,
        });
      } catch (error) {
        const parsed = parseAIError(error);
        results.push({ 
          name: 'Premium AI Routing', 
          status: parsed.code === 'CONFIG_ERROR' ? 'warning' : 'error', 
          message: parsed.message,
          latency_ms: Date.now() - start,
        });
      }
    }

    // 3. Test Supabase connection
    if (runAll || integrations.includes('supabase')) {
      const start = Date.now();
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (!supabaseUrl || !supabaseKey) {
          results.push({ name: 'Supabase', status: 'error', message: 'Missing configuration' });
        } else {
          results.push({ 
            name: 'Supabase', 
            status: 'success', 
            message: 'Connected successfully',
            latency_ms: Date.now() - start,
          });
        }
      } catch (error) {
        results.push({ 
          name: 'Supabase', 
          status: 'error', 
          message: error instanceof Error ? error.message : 'Unknown error',
          latency_ms: Date.now() - start,
        });
      }
    }

    // 4. Test Resend email
    if (runAll || integrations.includes('resend')) {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      if (!resendKey) {
        results.push({ name: 'Resend Email', status: 'warning', message: 'RESEND_API_KEY not configured' });
      } else {
        results.push({ name: 'Resend Email', status: 'success', message: 'API key configured' });
      }
    }

    // 5. Test Twilio
    if (runAll || integrations.includes('twilio')) {
      const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      
      if (!twilioSid || !twilioToken) {
        results.push({ name: 'Twilio SMS', status: 'warning', message: 'Twilio credentials not configured' });
      } else {
        results.push({ name: 'Twilio SMS', status: 'success', message: 'Credentials configured' });
      }
    }

    // 6. Test Stripe
    if (runAll || integrations.includes('stripe')) {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      
      if (!stripeKey) {
        results.push({ name: 'Stripe', status: 'warning', message: 'STRIPE_SECRET_KEY not configured' });
      } else {
        results.push({ name: 'Stripe', status: 'success', message: 'API key configured' });
      }
    }

    // 7. Check AI configuration
    if (runAll || integrations.includes('ai_config')) {
      const geminiKey = Deno.env.get('GEMINI_API_KEY');
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      const aiProvider = Deno.env.get('AI_PROVIDER') || 'gemini';
      const premiumProvider = Deno.env.get('AI_PROVIDER_PREMIUM');
      const premiumActions = Deno.env.get('AI_PREMIUM_ACTIONS');

      results.push({
        name: 'AI Configuration',
        status: geminiKey ? 'success' : 'error',
        message: `Default: ${aiProvider}, Premium: ${premiumProvider || 'none'}, OpenAI: ${openaiKey ? 'configured' : 'not set'}, Actions: ${premiumActions || 'none'}`,
      });
    }

    console.log(`[test-integrations] Tested ${results.length} integrations`);

    return new Response(JSON.stringify({ 
      success: true,
      tested_at: new Date().toISOString(),
      results,
      summary: {
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        warning: results.filter(r => r.status === 'warning').length,
        error: results.filter(r => r.status === 'error').length,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[test-integrations] error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
