import { CIV_CONSTITUTION } from "./policy/constitutionCore.js";
import { REQUIRED_INVARIANTS } from "./policy/invariantsCore.js";

export const HISTORY_DOMAIN = Object.freeze({
  ECONOMICS: "economics",
  GOVERNANCE: "governance",
  MEDICINE: "medicine",
  TECH: "tech",
  LABOR: "labor",
  SOCIAL: "social",
});

export const HISTORY_SOURCE_TYPE = Object.freeze({
  PRIMARY: "primary",
  SECONDARY: "secondary",
  DATA: "data",
});

export const HISTORY_ADDED_BY = Object.freeze({
  SYSTEM: "system",
  CURATOR: "curator",
});

const EVIDENCE_GRADES = Object.freeze(["A", "B", "C", "D"]);

const parseLogicalTime = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^h(\d+)$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const compareTime = (a, b) => {
  const parsedA = parseLogicalTime(a);
  const parsedB = parseLogicalTime(b);
  if (parsedA !== null && parsedB !== null) return parsedA - parsedB;
  return String(a).localeCompare(String(b));
};

const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeStringArray = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const unique = (values) => Array.from(new Set(values));

const normalizeDomain = (domain) => {
  if (domain === HISTORY_DOMAIN.ECONOMICS) return HISTORY_DOMAIN.ECONOMICS;
  if (domain === HISTORY_DOMAIN.GOVERNANCE) return HISTORY_DOMAIN.GOVERNANCE;
  if (domain === HISTORY_DOMAIN.MEDICINE) return HISTORY_DOMAIN.MEDICINE;
  if (domain === HISTORY_DOMAIN.TECH) return HISTORY_DOMAIN.TECH;
  if (domain === HISTORY_DOMAIN.LABOR) return HISTORY_DOMAIN.LABOR;
  if (domain === HISTORY_DOMAIN.SOCIAL) return HISTORY_DOMAIN.SOCIAL;
  throw new Error(`Invalid history domain: ${domain}`);
};

const normalizeEvidenceGrade = (grade) => {
  const value = typeof grade === "string" ? grade.trim().toUpperCase() : "";
  if (!EVIDENCE_GRADES.includes(value)) {
    throw new Error(`Invalid evidence_grade: ${grade}`);
  }
  return value;
};

const normalizeAddedBy = (addedBy) => {
  if (addedBy === HISTORY_ADDED_BY.SYSTEM) return HISTORY_ADDED_BY.SYSTEM;
  if (addedBy === HISTORY_ADDED_BY.CURATOR) return HISTORY_ADDED_BY.CURATOR;
  throw new Error(`Invalid added_by: ${addedBy}`);
};

const assertWriteAccess = (addedBy, writerRole) => {
  const normalized = normalizeAddedBy(addedBy);
  if (!writerRole) return normalized;
  const role = normalizeAddedBy(writerRole);
  if (role !== normalized) {
    throw new Error("writer_role does not match added_by.");
  }
  return normalized;
};

const validateScore = (value, name) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new Error(`${name} must be between 0 and 1.`);
  }
  return numeric;
};

const containsPrescriptiveLanguage = (text) => {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return /\b(should|ought|recommend|recommended|recommendation|must|optimize|optimise)\b/.test(normalized);
};

const normalizeSourceType = (value) => {
  if (value === HISTORY_SOURCE_TYPE.PRIMARY) return HISTORY_SOURCE_TYPE.PRIMARY;
  if (value === HISTORY_SOURCE_TYPE.SECONDARY) return HISTORY_SOURCE_TYPE.SECONDARY;
  if (value === HISTORY_SOURCE_TYPE.DATA) return HISTORY_SOURCE_TYPE.DATA;
  throw new Error(`Invalid source type: ${value}`);
};

const normalizeSource = (source) => {
  const author = isNonEmptyString(source?.author) ? source.author.trim() : "";
  const type = normalizeSourceType(source?.type);
  const date = isNonEmptyString(source?.date) ? source.date.trim() : "";
  if (!author) throw new Error("source.author is required.");
  if (!date) throw new Error("source.date is required.");
  return Object.freeze({ author, type, date });
};

const normalizeSources = (sources, label) => {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error(`${label} must include at least one source.`);
  }
  return Object.freeze(sources.map(normalizeSource));
};

const validateSourceRequirements = (sources, counterSources, controversyScore) => {
  const primaryAuthors = sources.filter((s) => s.type === HISTORY_SOURCE_TYPE.PRIMARY || s.type === HISTORY_SOURCE_TYPE.DATA);
  const secondaryAuthors = sources.filter((s) => s.type === HISTORY_SOURCE_TYPE.SECONDARY);

  if (primaryAuthors.length === 0) {
    throw new Error("At least one primary or data-based source is required.");
  }
  if (secondaryAuthors.length === 0) {
    throw new Error("At least one independent secondary source is required.");
  }

  const primaryAuthorSet = new Set(primaryAuthors.map((s) => s.author));
  const independentSecondary = secondaryAuthors.some((s) => !primaryAuthorSet.has(s.author));
  if (!independentSecondary) {
    throw new Error("Secondary source must be independent from primary/data authors.");
  }

  if (controversyScore > 0.3 && counterSources.length === 0) {
    throw new Error("counter_sources is required when controversy_score > 0.3.");
  }
};

const getForbiddenTargets = () => {
  const fromConstitution = CIV_CONSTITUTION.nonGoals.map(normalizeText);
  const fromInvariants = REQUIRED_INVARIANTS.flatMap((inv) => normalizeStringArray(inv.neverOptimizeFor)).map(normalizeText);
  return unique([...fromConstitution, ...fromInvariants]).filter(Boolean);
};

const findForbiddenTargets = (claimText) => {
  const forbidden = getForbiddenTargets();
  const normalized = normalizeText(claimText);
  if (!normalized) return [];
  return forbidden.filter((target) => normalized.includes(target));
};

export const createHistoryState = (seed = {}) => ({
  claims: Array.isArray(seed.claims) ? seed.claims.slice() : [],
  logicalClock: Number.isFinite(seed.logicalClock) ? seed.logicalClock : 0,
});

export const advanceHistoryClock = (state) => {
  const nextValue = Math.max(0, Number(state?.logicalClock ?? 0)) + 1;
  return { state: { ...state, logicalClock: nextValue }, value: `h${nextValue}` };
};

const ensureLogicalClock = (state, addedAt) => {
  const parsed = parseLogicalTime(addedAt);
  if (parsed === null) return state;
  if (parsed <= state.logicalClock) return state;
  return { ...state, logicalClock: parsed };
};

export const appendHistoryClaim = (state, input) => {
  const claimText = isNonEmptyString(input?.claim_text) ? input.claim_text.trim() : "";
  if (!claimText) throw new Error("claim_text is required.");
  if (containsPrescriptiveLanguage(claimText)) {
    throw new Error("claim_text must be descriptive only (no prescriptive language).");
  }

  if (findForbiddenTargets(claimText).length > 0) {
    throw new Error("claim_text cannot override Constitution or Invariants.");
  }

  const falsifiable = isNonEmptyString(input?.falsifiable_prompt) ? input.falsifiable_prompt.trim() : "";
  if (!falsifiable) throw new Error("falsifiable_prompt is required.");

  const evidenceGrade = normalizeEvidenceGrade(input?.evidence_grade);
  const confidenceScore = validateScore(input?.confidence_score, "confidence_score");
  const controversyScore = validateScore(input?.controversy_score, "controversy_score");

  const addedBy = assertWriteAccess(input?.added_by, input?.writer_role);
  const timeRange = isNonEmptyString(input?.time_range) ? input.time_range.trim() : "";
  const geography = isNonEmptyString(input?.geography) ? input.geography.trim() : "";
  if (!timeRange) throw new Error("time_range is required.");
  if (!geography) throw new Error("geography is required.");

  const sources = normalizeSources(input?.sources, "sources");
  const counterSources = Object.freeze((Array.isArray(input?.counter_sources) ? input.counter_sources : []).map(normalizeSource));

  validateSourceRequirements(sources, counterSources, controversyScore);

  const baseState = createHistoryState(state);
  let nextState = baseState;
  let addedAt = isNonEmptyString(input?.added_at) ? input.added_at.trim() : "";

  if (addedAt) {
    nextState = ensureLogicalClock(nextState, addedAt);
  } else {
    const advanced = advanceHistoryClock(nextState);
    nextState = advanced.state;
    addedAt = advanced.value;
  }

  const claimId = isNonEmptyString(input?.claim_id) ? input.claim_id.trim() : `claim-${addedAt}`;
  const domain = normalizeDomain(input?.domain);
  const challengeOf = isNonEmptyString(input?.challenge_of) ? input.challenge_of.trim() : null;

  const claim = Object.freeze({
    claim_id: claimId,
    claim_text: claimText,
    time_range: timeRange,
    geography,
    domain,
    sources,
    counter_sources: counterSources,
    evidence_grade: evidenceGrade,
    confidence_score: confidenceScore,
    controversy_score: controversyScore,
    added_by: addedBy,
    added_at: addedAt,
    falsifiable_prompt: falsifiable,
    challenge_of: challengeOf,
  });

  return {
    state: { ...nextState, claims: [...nextState.claims, claim] },
    claim,
  };
};

export const appendHistoryChallenge = (state, input) => {
  if (!isNonEmptyString(input?.challenge_of)) {
    throw new Error("challenge_of is required for challenge claims.");
  }
  return appendHistoryClaim(state, { ...input, challenge_of: input.challenge_of });
};

export const queryHistoryClaims = (state, request) => {
  const explicitQuery = request?.explicit_query === true;
  const intentId = isNonEmptyString(request?.intent_id) ? request.intent_id.trim() : "";
  if (!explicitQuery) {
    return Object.freeze({ ok: false, reason: "explicit_query_required", claims: Object.freeze([]) });
  }
  if (!intentId) {
    return Object.freeze({ ok: false, reason: "intent_required", claims: Object.freeze([]) });
  }

  const domain = request?.domain ? normalizeDomain(request.domain) : null;
  const geography = isNonEmptyString(request?.geography) ? request.geography.trim() : null;
  const timeRange = isNonEmptyString(request?.time_range) ? request.time_range.trim() : null;
  const matches = (state?.claims ?? []).filter((claim) => {
    if (domain && claim.domain !== domain) return false;
    if (geography && claim.geography !== geography) return false;
    if (timeRange && claim.time_range !== timeRange) return false;
    return true;
  });

  return Object.freeze({
    ok: true,
    reason: "explicit_query",
    claims: Object.freeze(matches.map((claim) => Object.freeze({ ...claim }))),
  });
};

export const evaluateHistoryUsage = (input) => {
  const explicitIntent = input?.explicit_intent === true;
  const purpose = isNonEmptyString(input?.purpose) ? input.purpose.trim() : "";
  const requestedBy = isNonEmptyString(input?.requested_by) ? input.requested_by.trim() : "";
  const overridesConstitution = input?.overrides_constitution === true;
  const overridesInvariants = input?.overrides_invariants === true;

  if (!explicitIntent) {
    return Object.freeze({ ok: false, reason: "explicit_intent_required" });
  }
  if (purpose !== "context") {
    return Object.freeze({ ok: false, reason: "context_only" });
  }
  if (requestedBy === "ceo_pilot" && purpose !== "context") {
    return Object.freeze({ ok: false, reason: "ceo_context_only" });
  }
  if (overridesConstitution || overridesInvariants) {
    return Object.freeze({ ok: false, reason: "cannot_override_constitution_or_invariants" });
  }

  return Object.freeze({ ok: true, reason: "context_allowed" });
};

export const getHistoryLedger = (claims) =>
  (Array.isArray(claims) ? claims.slice() : [])
    .slice()
    .sort((a, b) => compareTime(a.added_at, b.added_at))
    .map((claim) => Object.freeze({ ...claim }));
