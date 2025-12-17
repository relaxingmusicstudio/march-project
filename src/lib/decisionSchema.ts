/**
 * Decision Framing Standard - CLIENT SIDE
 * 
 * MUST MIRROR SERVER SCHEMA EXACTLY.
 * Server-side is authoritative: supabase/functions/_shared/decisionSchema.ts
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

// STRICT ENUMS - Must match server-side exactly
const VALID_RISK_LEVELS = ['low', 'medium', 'med', 'high'];
const VALID_REVERSIBILITY = ['instant', 'easy', 'hard'];
const MAX_SUMMARY_LENGTH = 180;

/**
 * Validates and normalizes a decision card
 * MIRRORS SERVER-SIDE VALIDATION EXACTLY
 */
export function validateDecisionCard(input: unknown): ValidationResult {
  const missingFields: string[] = [];
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return {
      isValid: false,
      missingFields: REQUIRED_FIELDS,
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

  // Normalize and validate individual fields
  const normalized: DecisionCard = {
    decision_type: normalizeSnakeCase(String(data.decision_type)),
    summary: String(data.summary).trim().slice(0, MAX_SUMMARY_LENGTH),
    why_now: String(data.why_now).trim(),
    expected_impact: String(data.expected_impact).trim(),
    cost: String(data.cost).trim(),
    risk: normalizeRisk(String(data.risk)),
    reversibility: normalizeReversibility(String(data.reversibility)),
    requires: normalizeRequires(data.requires),
    confidence: clampConfidence(data.confidence),
  };

  // Validate summary length warning
  if (String(data.summary).length > MAX_SUMMARY_LENGTH) {
    errors.push(`Summary truncated from ${String(data.summary).length} to ${MAX_SUMMARY_LENGTH} chars`);
  }

  // Validate decision_type is snake_case
  if (!/^[a-z][a-z0-9_]*$/.test(normalized.decision_type)) {
    errors.push('decision_type must be snake_case');
  }

  // Validate expected_impact contains measurable outcome
  if (!containsMeasurableOutcome(normalized.expected_impact)) {
    errors.push('expected_impact should include a measurable outcome (number, percentage, timeframe)');
  }

  // Validate risk starts with valid level
  const riskLevel = normalized.risk.split(' ')[0]?.toLowerCase();
  if (!VALID_RISK_LEVELS.includes(riskLevel)) {
    errors.push(`risk must start with: ${VALID_RISK_LEVELS.join('/')}`);
  }

  // Validate reversibility
  if (!VALID_REVERSIBILITY.includes(normalized.reversibility.toLowerCase())) {
    errors.push(`reversibility must be: ${VALID_REVERSIBILITY.join('/')}`);
  }

  // Add optional fields if present
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

  // Decision is valid if no critical missing fields
  // Warnings (truncation, measurable suggestion) don't block validity
  const criticalErrors = errors.filter(e => 
    !e.includes('truncated') && 
    !e.includes('should include')
  );

  return {
    isValid: criticalErrors.length === 0,
    missingFields: [],
    normalizedDecision: normalized,
    errors
  };
}

/**
 * Converts to snake_case
 */
function normalizeSnakeCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Normalizes risk field (ensures level prefix)
 */
function normalizeRisk(risk: string): string {
  const trimmed = risk.trim();
  const lower = trimmed.toLowerCase();
  
  // If it already starts with a valid level, return as-is
  for (const level of VALID_RISK_LEVELS) {
    if (lower.startsWith(level)) {
      return trimmed;
    }
  }
  
  // Default to "medium - " prefix if no level found
  return `medium - ${trimmed}`;
}

/**
 * Normalizes reversibility field
 */
function normalizeReversibility(rev: string): string {
  const lower = rev.trim().toLowerCase();
  
  if (lower.includes('instant') || lower.includes('immediate')) return 'instant';
  if (lower.includes('easy') || lower.includes('simple')) return 'easy';
  if (lower.includes('hard') || lower.includes('difficult') || lower.includes('irreversible')) return 'hard';
  
  return 'easy'; // Default
}

/**
 * Normalizes requires array
 */
function normalizeRequires(requires: unknown): string[] {
  if (Array.isArray(requires)) {
    return requires.map(r => String(r).trim()).filter(r => r.length > 0);
  }
  if (typeof requires === 'string') {
    return requires.split(',').map(r => r.trim()).filter(r => r.length > 0);
  }
  return [];
}

/**
 * Clamps confidence to 0.0-1.0
 */
function clampConfidence(conf: unknown): number {
  const num = Number(conf);
  if (isNaN(num)) return 0.5;
  return Math.max(0, Math.min(1, num));
}

/**
 * Checks if text contains measurable outcome indicators
 */
function containsMeasurableOutcome(text: string): boolean {
  const patterns = [
    /\d+/,           // Any number
    /%/,             // Percentage
    /\$/,            // Dollar amount
    /increase|decrease|reduce|grow|improve/i,
    /day|week|month|hour|minute/i,
    /x\d|\d+x/i,     // Multipliers like 2x, x3
  ];
  
  return patterns.some(p => p.test(text));
}

/**
 * Creates a blank decision card template
 */
export function createDecisionTemplate(type: string): Partial<DecisionCard> {
  return {
    decision_type: normalizeSnakeCase(type),
    summary: '',
    why_now: '',
    expected_impact: '',
    cost: '',
    risk: 'medium - ',
    reversibility: 'easy',
    requires: [],
    confidence: 0.5,
  };
}

/**
 * Extracts decision card from action_payload if present
 */
export function extractDecisionCard(payload: unknown): DecisionCard | null {
  if (!payload || typeof payload !== 'object') return null;
  
  const p = payload as Record<string, unknown>;
  
  // Check if it has a nested decision_card
  if (p.decision_card && typeof p.decision_card === 'object') {
    const result = validateDecisionCard(p.decision_card);
    return result.isValid ? result.normalizedDecision : null;
  }
  
  // Check if the payload itself is a decision card
  const result = validateDecisionCard(payload);
  return result.isValid ? result.normalizedDecision : null;
}

/**
 * Wraps payload with decision_card for modify flow
 */
export function wrapWithModification(
  existingPayload: Record<string, unknown>,
  humanModification: string
): Record<string, unknown> {
  const existingCard = extractDecisionCard(existingPayload);
  
  if (existingCard) {
    // Update existing decision_card with human modification
    return {
      ...existingPayload,
      decision_card: {
        ...existingCard,
        human_modification: humanModification,
      }
    };
  }
  
  // No existing decision_card - add modification to payload
  return {
    ...existingPayload,
    human_modification: humanModification,
    modified_at: new Date().toISOString()
  };
}
