import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntegrationResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'skipped';
  message: string;
  latency_ms?: number;
  details?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integrations = ['all'] } = await req.json().catch(() => ({ integrations: ['all'] }));
    const results: IntegrationResult[] = [];
    const runAll = integrations.includes('all');

    // 1. Test Lovable AI
    if (runAll || integrations.includes('lovable_ai')) {
      const start = Date.now();
      try {
        const apiKey = Deno.env.get('LOVABLE_API_KEY');
        if (!apiKey) {
          results.push({ name: 'Lovable AI', status: 'error', message: 'LOVABLE_API_KEY not configured' });
        } else {
          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite',
              messages: [{ role: 'user', content: 'Say "test successful" in 3 words or less' }],
              max_tokens: 10,
            }),
          });
          
          if (response.ok) {
            results.push({ 
              name: 'Lovable AI', 
              status: 'success', 
              message: 'Connected successfully',
              latency_ms: Date.now() - start,
            });
          } else {
            results.push({ 
              name: 'Lovable AI', 
              status: 'error', 
              message: `API error: ${response.status}`,
              latency_ms: Date.now() - start,
            });
          }
        }
      } catch (e) {
        results.push({ name: 'Lovable AI', status: 'error', message: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    // 2. Test ElevenLabs
    if (runAll || integrations.includes('elevenlabs')) {
      const start = Date.now();
      try {
        const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
        if (!apiKey) {
          results.push({ name: 'ElevenLabs', status: 'error', message: 'ELEVENLABS_API_KEY not configured' });
        } else {
          // Test with voice list endpoint (low cost)
          const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': apiKey },
          });
          
          if (response.ok) {
            const data = await response.json();
            results.push({ 
              name: 'ElevenLabs', 
              status: 'success', 
              message: `Connected - ${data.voices?.length || 0} voices available`,
              latency_ms: Date.now() - start,
            });
          } else {
            results.push({ 
              name: 'ElevenLabs', 
              status: 'error', 
              message: `API error: ${response.status}`,
              latency_ms: Date.now() - start,
            });
          }
        }
      } catch (e) {
        results.push({ name: 'ElevenLabs', status: 'error', message: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    // 3. Test Database
    if (runAll || integrations.includes('database')) {
      const start = Date.now();
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const { error } = await supabase.from('profiles').select('id').limit(1);
        
        if (!error) {
          results.push({ 
            name: 'Database', 
            status: 'success', 
            message: 'Connected successfully',
            latency_ms: Date.now() - start,
          });
        } else {
          results.push({ 
            name: 'Database', 
            status: 'error', 
            message: error.message,
            latency_ms: Date.now() - start,
          });
        }
      } catch (e) {
        results.push({ name: 'Database', status: 'error', message: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    // 4. Test Stripe
    if (runAll || integrations.includes('stripe')) {
      const start = Date.now();
      try {
        const apiKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!apiKey) {
          results.push({ name: 'Stripe', status: 'error', message: 'STRIPE_SECRET_KEY not configured' });
        } else {
          const response = await fetch('https://api.stripe.com/v1/balance', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });
          
          if (response.ok) {
            results.push({ 
              name: 'Stripe', 
              status: 'success', 
              message: 'Connected successfully',
              latency_ms: Date.now() - start,
            });
          } else {
            results.push({ 
              name: 'Stripe', 
              status: 'error', 
              message: `API error: ${response.status}`,
              latency_ms: Date.now() - start,
            });
          }
        }
      } catch (e) {
        results.push({ name: 'Stripe', status: 'error', message: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    // 5. Test Resend
    if (runAll || integrations.includes('resend')) {
      const start = Date.now();
      try {
        const apiKey = Deno.env.get('RESEND_API_KEY');
        if (!apiKey) {
          results.push({ name: 'Resend', status: 'error', message: 'RESEND_API_KEY not configured' });
        } else {
          const response = await fetch('https://api.resend.com/domains', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });
          
          if (response.ok) {
            results.push({ 
              name: 'Resend', 
              status: 'success', 
              message: 'Connected successfully',
              latency_ms: Date.now() - start,
            });
          } else {
            results.push({ 
              name: 'Resend', 
              status: 'error', 
              message: `API error: ${response.status}`,
              latency_ms: Date.now() - start,
            });
          }
        }
      } catch (e) {
        results.push({ name: 'Resend', status: 'error', message: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    // 6. Test D-ID (Avatar)
    if (runAll || integrations.includes('did')) {
      const start = Date.now();
      try {
        const apiKey = Deno.env.get('DID_API_KEY');
        if (!apiKey) {
          results.push({ name: 'D-ID (Avatar)', status: 'warning', message: 'DID_API_KEY not configured - avatar videos will be unavailable' });
        } else {
          const response = await fetch('https://api.d-id.com/credits', {
            headers: { 'Authorization': `Basic ${apiKey}` },
          });
          
          if (response.ok) {
            const data = await response.json();
            results.push({ 
              name: 'D-ID (Avatar)', 
              status: 'success', 
              message: `Connected - ${data.credits_remaining || 0} credits remaining`,
              latency_ms: Date.now() - start,
              details: { credits: data.credits_remaining },
            });
          } else {
            results.push({ 
              name: 'D-ID (Avatar)', 
              status: 'error', 
              message: `API error: ${response.status}`,
              latency_ms: Date.now() - start,
            });
          }
        }
      } catch (e) {
        results.push({ name: 'D-ID (Avatar)', status: 'error', message: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    // 7. Test VAPI (deprecated - should show warning)
    if (runAll || integrations.includes('vapi')) {
      const vapiKey = Deno.env.get('VAPI_API_KEY');
      if (vapiKey) {
        results.push({ 
          name: 'VAPI', 
          status: 'warning', 
          message: 'VAPI is deprecated - migrating to ElevenLabs Conversational AI',
        });
      } else {
        results.push({ 
          name: 'VAPI', 
          status: 'skipped', 
          message: 'VAPI not configured (good - using ElevenLabs instead)',
        });
      }
    }

    // Calculate summary
    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      error: results.filter(r => r.status === 'error').length,
      warning: results.filter(r => r.status === 'warning').length,
      skipped: results.filter(r => r.status === 'skipped').length,
    };

    console.log('Integration test complete:', summary);

    return new Response(JSON.stringify({
      success: summary.error === 0,
      timestamp: new Date().toISOString(),
      summary,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in test-integrations function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
