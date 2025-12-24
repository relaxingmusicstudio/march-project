import { createThreadStoreState, ThreadStoreState } from "./lifelongThreads";

const THREAD_STORE_PREFIX = "ppp:threads:v1::";

const makeThreadStoreKey = (userId?: string | null, email?: string | null) =>
  `${THREAD_STORE_PREFIX}${userId || email || "anonymous"}`;

export const loadThreadStoreState = (userId?: string | null, email?: string | null): ThreadStoreState => {
  if (typeof window === "undefined" || !window.localStorage) {
    return createThreadStoreState();
  }
  const key = makeThreadStoreKey(userId, email);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return createThreadStoreState();
    const parsed = JSON.parse(raw) as Partial<ThreadStoreState>;
    return createThreadStoreState(parsed);
  } catch {
    return createThreadStoreState();
  }
};

export const saveThreadStoreState = (state: ThreadStoreState, userId?: string | null, email?: string | null) => {
  if (typeof window === "undefined" || !window.localStorage) return;
  const key = makeThreadStoreKey(userId, email);
  window.localStorage.setItem(key, JSON.stringify(state));
};
