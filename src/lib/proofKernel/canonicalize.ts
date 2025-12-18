/**
 * Proof Kernel - Canonicalize
 * Deterministic JSON stringify with stable key ordering
 */

/**
 * Recursively sort object keys for deterministic serialization
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  
  return obj;
}

/**
 * Canonical JSON stringify - produces deterministic output
 * Keys are sorted alphabetically at all levels
 */
export function canonicalize(obj: unknown): string {
  const sorted = sortObjectKeys(obj);
  return JSON.stringify(sorted);
}

/**
 * Canonical JSON stringify with pretty printing
 */
export function canonicalizePretty(obj: unknown, indent = 2): string {
  const sorted = sortObjectKeys(obj);
  return JSON.stringify(sorted, null, indent);
}

/**
 * Parse and re-canonicalize a JSON string
 */
export function recanonicalizeJSON(jsonStr: string): string {
  try {
    const parsed = JSON.parse(jsonStr);
    return canonicalize(parsed);
  } catch {
    throw new Error("Invalid JSON for canonicalization");
  }
}
