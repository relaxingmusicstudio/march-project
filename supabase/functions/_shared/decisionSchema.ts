/**
 * Decision Framing Standard - Server-Side Validator
 * 
 * Every CEO proposal must follow this schema before being enqueued.
 * This is the authoritative server-side enforcement.
 */

export interface DecisionCard {
  decision_type: string;       // snake_case identifier
  summary: string;             // <= 180 chars
  why_now: string;            // urgency/timing justification
  expected_impact: string;    // must include measurable outcome
  cost: string;               // money/time estimate
  risk: string;               // low/med/high + one sentence
  reversibility: string;      // instant / easy / hard
  requires: string[];         // dependencies or inputs needed
  confidence: number;         // 0.0–1.0

  // Optional fields
  proposed_payload?: Record<string, unknown>;
  success_metric?: string;
  rollback_hint?: string;
  human_modification?: string;
}

export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  normalizedDecision: DecisionCard | null;
  errors: string[];
}

const REQUIRED_FIELDS: (keyof DecisionCard)[] = [
  'decision_type',
  'summary',
  'why_now',
  'expected_impact',
  'cost',
  'risk',
  'reversibility',
  'requires',
  'confidence'
];

const MAX_SUMMARY_LENGTH = 180;

/**
 * Validates and normalizes a decision card - SERVER SIDE
 */
export function validateDecisionCard(input: unknown): ValidationResult {
  const missingFields: string[] = [];
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return {
      isValid: false,
      missingFields: REQUIRED_FIELDS as string[],
      normalizedDecision: null,
      errors: ['Input must be a valid object']
    };
  }

  const data = input as Record<string, unknown>;

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return {
      isValid: false,
      missingFields,
      normalizedDecision: null,
      errors: [`Missing required fields: ${missingFields.join(', ')}`]
    };
  }

  // Normalize decision card
  const normalized: DecisionCard = {
    decision_type: normalizeSnakeCase(String(data.decision_type)),
    summary: String(data.summary).trim().slice(0, MAX_SUMMARY_LENGTH),
    why_now: String(data.why_now).trim(),
    expected_impact: String(data.expected_impact).trim(),
    cost: String(data.cost).trim(),
    risk: String(data.risk).trim(),
    reversibility: String(data.reversibility).trim().toLowerCase(),
    requires: normalizeRequires(data.requires),
    confidence: clampConfidence(data.confidence),
  };

  // Add optional fields
  if (data.proposed_payload && typeof data.proposed_payload === 'object') {
    normalized.proposed_payload = data.proposed_payload as Record<string, unknown>;
  }
  if (data.success_metric) {
    normalized.success_metric = String(data.success_metric).trim();
  }
  if (data.rollback_hint) {
    normalized.rollback_hint = String(data.rollback_hint).trim();
  }
  if (data.human_modification) {
    normalized.human_modification = String(data.human_modification).trim();
  }

  return {
    isValid: true,
    missingFields: [],
    normalizedDecision: normalized,
    errors
  };
}

function normalizeSnakeCase(str: string): string {
  return str.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function normalizeRequires(requires: unknown): string[] {
  if (Array.isArray(requires)) {
    return requires.map(r => String(r).trim()).filter(r => r.length > 0);
  }
  if (typeof requires === 'string') {
    return requires.split(',').map(r => r.trim()).filter(r => r.length > 0);
  }
  return [];
}

function clampConfidence(conf: unknown): number {
  const num = Number(conf);
  if (isNaN(num)) return 0.5;
  return Math.max(0, Math.min(1, num));
}

/**
 * Wraps action payload with validated decision card
 */
export function wrapWithDecisionCard(
  decisionCard: DecisionCard,
  originalPayload?: Record<string, unknown>
): Record<string, unknown> {
  return {
    decision_card: decisionCard,
    ...(originalPayload || {})
  };
}

/**
 * Logs validation failure for debugging
 */
export function logValidationFailure(
  source: string,
  input: unknown,
  result: ValidationResult
): void {
  console.error(`[DecisionSchema] Validation failed in ${source}:`, {
    missingFields: result.missingFields,
    errors: result.errors,
    inputKeys: input && typeof input === 'object' ? Object.keys(input) : 'not-object'
  });
}
