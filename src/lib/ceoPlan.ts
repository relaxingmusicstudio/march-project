import { getOnboardingData } from "./onboarding";

export type CEOPlan = {
  planMarkdown: string;
  createdAt: string;
  updatedAt: string;
  onboardingSnapshotHash: string;
};

const PLAN_PREFIX = "ppp:ceoPlan:v1::";

const makePlanKey = (userId?: string | null, email?: string | null) =>
  `${PLAN_PREFIX}${userId || email || "anonymous"}`;

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // keep 32-bit
  }
  return `h${Math.abs(hash)}`;
};

export const computeOnboardingHash = (userId?: string | null, email?: string | null) =>
  hashString(JSON.stringify(getOnboardingData(userId, email)));

export const loadCEOPlan = (userId?: string | null, email?: string | null): CEOPlan | null => {
  const key = makePlanKey(userId, email);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CEOPlan;
  } catch {
    return null;
  }
};

export const saveCEOPlan = (plan: CEOPlan, userId?: string | null, email?: string | null) => {
  const key = makePlanKey(userId, email);
  localStorage.setItem(key, JSON.stringify(plan));
};
