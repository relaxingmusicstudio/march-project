/**
 * Proof Kernel - Hash
 * SHA-256 hashing using Web Crypto API
 */

import { canonicalize } from './canonicalize';

/**
 * Compute SHA-256 hash of a string using Web Crypto
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.toUpperCase();
}

/**
 * Compute SHA-256 hash of an object after canonicalization
 */
export async function hashObject(obj: unknown): Promise<string> {
  const canonical = canonicalize(obj);
  return sha256(canonical);
}

/**
 * Generate a proof token from an object
 * Format: PROOF-{timestamp14}-{sha256_first16}
 */
export async function generateProofTokenFromObject(
  obj: unknown,
  timestamp?: string
): Promise<string> {
  const hash = await hashObject(obj);
  const ts = (timestamp || new Date().toISOString())
    .replace(/[-:TZ.]/g, '')
    .substring(0, 14);
  return `PROOF-${ts}-${hash.substring(0, 16)}`;
}

/**
 * Verify a proof token matches an object
 */
export async function verifyProofToken(
  token: string,
  obj: unknown
): Promise<boolean> {
  const hash = await hashObject(obj);
  const expectedHashPart = hash.substring(0, 16);
  // Token format: PROOF-{timestamp}-{hash16}
  const parts = token.split('-');
  if (parts.length !== 3 || parts[0] !== 'PROOF') {
    return false;
  }
  return parts[2] === expectedHashPart;
}
