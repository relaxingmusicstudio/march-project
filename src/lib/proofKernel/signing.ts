/**
 * Proof Kernel - Signing
 * Request cryptographic signature from edge function
 */

import { supabase } from '@/integrations/supabase/client';
import { hashObject } from './hash';
import { canonicalize } from './canonicalize';

export interface SigningResult {
  success: boolean;
  signature?: string;
  signed_at?: string;
  error?: string;
}

/**
 * Request a signature from the proof-sign edge function
 */
export async function requestProofSignature(
  proofToken: string,
  packHash: string
): Promise<SigningResult> {
  try {
    const { data, error } = await supabase.functions.invoke('proof-sign', {
      body: {
        proof_token: proofToken,
        pack_hash: packHash,
      },
    });

    if (error) {
      return {
        success: false,
        error: `Edge function error: ${error.message}`,
      };
    }

    if (data?.signature) {
      return {
        success: true,
        signature: data.signature,
        signed_at: data.signed_at || new Date().toISOString(),
      };
    }

    return {
      success: false,
      error: data?.error || 'No signature returned',
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Sign an evidence pack and return the signature
 */
export async function signEvidencePack(pack: unknown): Promise<SigningResult> {
  try {
    const packHash = await hashObject(pack);
    const canonical = canonicalize(pack);
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').substring(0, 14);
    const proofToken = `PROOF-${timestamp}-${packHash.substring(0, 16)}`;
    
    return requestProofSignature(proofToken, packHash);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Verify a signature (client-side verification not possible without public key)
 * This would need to call an edge function to verify
 */
export async function verifySignature(
  proofToken: string,
  signature: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('proof-sign', {
      body: {
        action: 'verify',
        proof_token: proofToken,
        signature,
      },
    });

    if (error) {
      return { valid: false, error: error.message };
    }

    return { valid: data?.valid ?? false, error: data?.error };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : String(e) };
  }
}
