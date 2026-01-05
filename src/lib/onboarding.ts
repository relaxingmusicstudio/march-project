export type OnboardingStatus = "not_started" | "in_progress" | "complete";

export type OnboardingData = {
  businessName: string;
  industry: string;
  serviceArea: string;
  primaryGoal: string;
  offerPricing: string;
  targetCustomer: string;
  leadSources: string;
  calendarLink?: string;
  contactPhone?: string;
};

export type OnboardingState = {
  status: OnboardingStatus;
  data: OnboardingData;
  stepCompleted: number;
  updatedAt: string | null;
};

export const ONBOARDING_TOTAL_STEPS = 3;

const STORAGE_PREFIX = "ppp:onboarding:v1::";
const LEGACY_STORAGE_PREFIX = "onboarding_v1::";

const DEFAULT_DATA: OnboardingData = {
  businessName: "",
  industry: "",
  serviceArea: "",
  primaryGoal: "",
  offerPricing: "",
  targetCustomer: "",
  leadSources: "",
  calendarLink: "",
  contactPhone: "",
};

const normalizeStepCompleted = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.max(0, Math.min(ONBOARDING_TOTAL_STEPS, Math.floor(value)));
  return clamped;
};

const hasAnyData = (data: OnboardingData) =>
  Object.values(data).some((value) => typeof value === "string" && value.trim().length > 0);

export const deriveOnboardingStatus = (
  stepCompleted: number,
  data: OnboardingData
): OnboardingStatus => {
  if (stepCompleted >= ONBOARDING_TOTAL_STEPS) return "complete";
  if (stepCompleted > 0 || hasAnyData(data)) return "in_progress";
  return "not_started";
};

export const buildOnboardingState = (
  partial: Partial<OnboardingData>,
  stepCompleted: number,
  updatedAt: string | null
): OnboardingState => {
  const data = { ...DEFAULT_DATA, ...partial };
  const normalizedStep = normalizeStepCompleted(stepCompleted);
  return {
    status: deriveOnboardingStatus(normalizedStep, data),
    data,
    stepCompleted: normalizedStep,
    updatedAt,
  };
};

export const defaultOnboardingState: OnboardingState = buildOnboardingState({}, 0, null);

const makeStorageKey = (prefix: string, userId?: string | null, email?: string | null) =>
  `${prefix}${userId || email || "anonymous"}`;

export const loadOnboardingState = (userId?: string | null, email?: string | null): OnboardingState => {
  const key = makeStorageKey(STORAGE_PREFIX, userId, email);
  const legacyKey = makeStorageKey(LEGACY_STORAGE_PREFIX, userId, email);
  try {
    const raw = localStorage.getItem(key) ?? localStorage.getItem(legacyKey);
    if (!raw) return defaultOnboardingState;
    const parsed = JSON.parse(raw) as OnboardingState;
    const normalized = buildOnboardingState(parsed.data || {}, parsed.stepCompleted ?? 0, parsed.updatedAt ?? null);
    // Migrate legacy key forward
    localStorage.setItem(key, JSON.stringify(normalized));
    if (legacyKey !== key) {
      localStorage.removeItem(legacyKey);
    }
    return normalized;
  } catch {
    return defaultOnboardingState;
  }
};

export const saveOnboardingState = (
  state: OnboardingState,
  userId?: string | null,
  email?: string | null
) => {
  const key = makeStorageKey(STORAGE_PREFIX, userId, email);
  localStorage.setItem(key, JSON.stringify(state));
};

export const clearOnboardingState = (userId?: string | null, email?: string | null) => {
  const key = makeStorageKey(STORAGE_PREFIX, userId, email);
  const legacyKey = makeStorageKey(LEGACY_STORAGE_PREFIX, userId, email);
  localStorage.removeItem(key);
  localStorage.removeItem(legacyKey);
};

export const getOnboardingData = (userId?: string | null, email?: string | null): OnboardingData => {
  const state = loadOnboardingState(userId, email);
  return state.data;
};
