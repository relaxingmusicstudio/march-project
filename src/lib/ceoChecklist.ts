import { getOnboardingData } from "./onboarding";
import { loadCEOPlan } from "./ceoPlan";

export type ChecklistItem = {
  id: string;
  text: string;
  section?: string;
  order: number;
};

export type ChecklistState = {
  completedIds: string[];
  updatedAt: string | null;
};

const CHECKLIST_PREFIX = "ppp:ceoPlanChecklist:v1::";
const DO_NEXT_PREFIX = "ppp:ceoDoNext:v1::";

const makeKey = (prefix: string, userId?: string | null, email?: string | null) =>
  `${prefix}${userId || email || "anonymous"}`;

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
};

export const parsePlanToChecklist = (planMarkdown?: string): ChecklistItem[] => {
  if (!planMarkdown) return [];
  const lines = planMarkdown.split(/\r?\n/);
  let currentSection: string | undefined;
  const items: ChecklistItem[] = [];

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;

    if (/^(#+\s+|Week\s+\d+|Day\s+\d+)/i.test(line)) {
      currentSection = line.replace(/^#+\s*/, "");
      return;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)/);
    const orderedMatch = line.match(/^\d+\.\s+(.*)/);
    const text = bulletMatch?.[1] || orderedMatch?.[1] || null;
    if (text) {
      const id = `ck-${idx}-${hashString(text)}`;
      items.push({ id, text: text.trim(), section: currentSection, order: items.length });
    }
  });

  return items;
};

export const loadChecklistState = (userId?: string | null, email?: string | null): ChecklistState => {
  const key = makeKey(CHECKLIST_PREFIX, userId, email);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { completedIds: [], updatedAt: null };
    return JSON.parse(raw) as ChecklistState;
  } catch {
    return { completedIds: [], updatedAt: null };
  }
};

export const saveChecklistState = (
  state: ChecklistState,
  userId?: string | null,
  email?: string | null
) => {
  const key = makeKey(CHECKLIST_PREFIX, userId, email);
  localStorage.setItem(key, JSON.stringify(state));
};

export type DoNextState = {
  taskId: string;
  responseMarkdown: string;
  updatedAt: string;
};

export const loadDoNextState = (userId?: string | null, email?: string | null): DoNextState | null => {
  const key = makeKey(DO_NEXT_PREFIX, userId, email);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as DoNextState;
  } catch {
    return null;
  }
};

export const saveDoNextState = (
  state: DoNextState,
  userId?: string | null,
  email?: string | null
) => {
  const key = makeKey(DO_NEXT_PREFIX, userId, email);
  localStorage.setItem(key, JSON.stringify(state));
};

export const getPlanChecklist = (userId?: string | null, email?: string | null): ChecklistItem[] => {
  const plan = loadCEOPlan(userId, email);
  if (!plan) return [];
  return parsePlanToChecklist(plan.planMarkdown);
};

export const getOnboardingSnapshotHash = (userId?: string | null, email?: string | null) =>
  hashString(JSON.stringify(getOnboardingData(userId, email)));
