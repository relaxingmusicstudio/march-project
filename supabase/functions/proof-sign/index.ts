import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * HMAC-SHA256 signing using service role secret
 */
async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Verify HMAC-SHA256 signature
 */
async function hmacVerify(message: string, signature: string, secret: string): Promise<boolean> {
  const expectedSig = await hmacSign(message, secret);
  return expectedSig === signature.toUpperCase();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, proof_token, pack_hash, signature } = await req.json();
    
    // Get signing secret from environment
    const signingSecret = Deno.env.get("PROOF_SIGNING_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!signingSecret) {
      console.error("[proof-sign] No signing secret configured");
      return new Response(
        JSON.stringify({ error: "Signing secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verification action
    if (action === "verify") {
      if (!proof_token || !signature) {
        return new Response(
          JSON.stringify({ error: "Missing proof_token or signature for verification" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const valid = await hmacVerify(proof_token, signature, signingSecret);
      console.log(`[proof-sign] Verification: token=${proof_token.substring(0, 20)}..., valid=${valid}`);
      
      return new Response(
        JSON.stringify({ valid, verified_at: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Signing action (default)
    if (!proof_token || !pack_hash) {
      return new Response(
        JSON.stringify({ error: "Missing proof_token or pack_hash" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create message to sign: token + hash
    const messageToSign = `${proof_token}:${pack_hash}`;
    const sig = await hmacSign(messageToSign, signingSecret);
    
    console.log(`[proof-sign] Signed: token=${proof_token.substring(0, 20)}..., hash=${pack_hash.substring(0, 16)}...`);

    return new Response(
      JSON.stringify({
        signature: sig,
        signed_at: new Date().toISOString(),
        proof_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("[proof-sign] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
