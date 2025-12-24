export const THREAD_SCOPE = Object.freeze({
  PRIVATE: "PRIVATE",
  POD_PRIVATE: "POD_PRIVATE",
  PUBLIC: "PUBLIC",
});

export const THREAD_AUTHOR_TYPE = Object.freeze({
  USER: "user",
  AGENT: "agent",
  SYSTEM: "system",
});

const normalizeStringArray = (value) =>
  Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .sort()
    : [];

const parseLogicalTime = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^t(\d+)$/);
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

const compareEntries = (a, b) => {
  const time = compareTime(a.created_at, b.created_at);
  if (time !== 0) return time;
  return String(a.entry_id).localeCompare(String(b.entry_id));
};

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
};

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
};

const normalizeEntryForDigest = (entry) => ({
  entry_id: entry.entry_id,
  thread_id: entry.thread_id,
  author_type: entry.author_type,
  intent_id: entry.intent_id ?? "",
  created_at: entry.created_at,
  content_text: entry.content_text,
  content_redacted: entry.content_redacted ?? "",
  pii_flags: normalizeStringArray(entry.pii_flags),
  refs: normalizeStringArray(entry.refs),
});

export const createThreadStoreState = (seed = {}) => ({
  threads: Array.isArray(seed.threads) ? seed.threads.slice() : [],
  entries: Array.isArray(seed.entries) ? seed.entries.slice() : [],
  snapshots: Array.isArray(seed.snapshots) ? seed.snapshots.slice() : [],
  logicalClock: Number.isFinite(seed.logicalClock) ? seed.logicalClock : 0,
});

export const advanceClock = (state) => {
  const nextClock = (Number.isFinite(state.logicalClock) ? state.logicalClock : 0) + 1;
  const nextState = { ...state, logicalClock: nextClock };
  return { state: nextState, value: `t${nextClock}` };
};

const ensureLogicalClock = (state, createdAt) => {
  const parsed = parseLogicalTime(createdAt);
  if (parsed === null) return state;
  if (parsed <= state.logicalClock) return state;
  return { ...state, logicalClock: parsed };
};

export const getThreadEntriesOrdered = (entries, threadId) =>
  entries
    .filter((entry) => entry.thread_id === threadId)
    .slice()
    .sort(compareEntries);

export const buildThreadSnapshot = (threadId, entries, createdAtOverride) => {
  const ordered = getThreadEntriesOrdered(entries, threadId);
  const latest = ordered.length > 0 ? ordered[ordered.length - 1] : null;
  const normalizedEntries = ordered.map(normalizeEntryForDigest);
  const digest = hashString(stableStringify({ thread_id: threadId, entries: normalizedEntries }));
  const lastUpdated = latest?.created_at ?? createdAtOverride ?? "t0";
  const summaryFields = {
    entry_count: ordered.length,
    redacted_count: ordered.filter((entry) => Boolean(entry.content_redacted)).length,
    last_updated: lastUpdated,
  };

  return {
    thread_id: threadId,
    snapshot_version: "v1",
    latest_entry_id: latest?.entry_id ?? null,
    digest,
    summary_fields: summaryFields,
    created_at: createdAtOverride ?? lastUpdated,
  };
};

export const saveThreadSnapshot = (state, snapshot) => {
  const snapshots = state.snapshots.filter((item) => item.thread_id !== snapshot.thread_id);
  return { ...state, snapshots: [...snapshots, snapshot] };
};

export const getLatestSnapshot = (snapshots, threadId) => {
  const filtered = snapshots.filter((snapshot) => snapshot.thread_id === threadId);
  if (filtered.length === 0) return null;
  const ordered = filtered
    .slice()
    .sort((a, b) => {
      const time = compareTime(a.created_at, b.created_at);
      if (time !== 0) return time;
      return String(a.digest).localeCompare(String(b.digest));
    });
  return ordered[ordered.length - 1] ?? null;
};

export const getThreadSummary = (threadId, entries, snapshot) => {
  if (snapshot && snapshot.thread_id === threadId) return snapshot.summary_fields;
  const ordered = getThreadEntriesOrdered(entries, threadId);
  const last = ordered.length > 0 ? ordered[ordered.length - 1] : null;
  return {
    entry_count: ordered.length,
    redacted_count: ordered.filter((entry) => Boolean(entry.content_redacted)).length,
    last_updated: last?.created_at ?? "t0",
  };
};

export const createThread = (state, input) => {
  if (!input?.owner_id) throw new Error("owner_id is required to create a thread.");
  const baseState = createThreadStoreState(state);
  let nextState = baseState;
  let createdAt = input.created_at;

  if (createdAt) {
    nextState = ensureLogicalClock(nextState, createdAt);
  } else {
    const advanced = advanceClock(nextState);
    nextState = advanced.state;
    createdAt = advanced.value;
  }

  const threadId = input.thread_id ?? `thread-${createdAt}`;
  const updatedAt = input.updated_at ?? createdAt;
  const thread = {
    thread_id: threadId,
    owner_id: input.owner_id,
    scope: input.scope ?? THREAD_SCOPE.PRIVATE,
    created_at: createdAt,
    updated_at: updatedAt,
  };

  return { state: { ...nextState, threads: [...nextState.threads, thread] }, thread };
};

export const appendThreadEntry = (state, input) => {
  if (!input?.thread_id) throw new Error("thread_id is required to append an entry.");
  if (!input?.author_type) throw new Error("author_type is required to append an entry.");
  const baseState = createThreadStoreState(state);
  const targetThread = baseState.threads.find((thread) => thread.thread_id === input.thread_id);
  if (!targetThread) throw new Error(`Thread not found: ${input.thread_id}`);

  let nextState = baseState;
  let createdAt = input.created_at;

  if (createdAt) {
    nextState = ensureLogicalClock(nextState, createdAt);
  } else {
    const advanced = advanceClock(nextState);
    nextState = advanced.state;
    createdAt = advanced.value;
  }

  const entryId = input.entry_id ?? `entry-${createdAt}`;
  const entry = {
    entry_id: entryId,
    thread_id: input.thread_id,
    author_type: input.author_type,
    intent_id: input.intent_id,
    created_at: createdAt,
    content_text: input.content_text ?? "",
    content_redacted: input.content_redacted,
    pii_flags: normalizeStringArray(input.pii_flags),
    refs: normalizeStringArray(input.refs),
  };

  const entries = [...nextState.entries, entry];
  const threads = nextState.threads.map((thread) =>
    thread.thread_id === input.thread_id ? { ...thread, updated_at: createdAt } : thread
  );

  return { state: { ...nextState, entries, threads }, entry };
};

export const appendRedactionEntry = (state, input) =>
  appendThreadEntry(state, {
    thread_id: input.thread_id,
    author_type: input.author_type ?? THREAD_AUTHOR_TYPE.SYSTEM,
    intent_id: input.intent_id,
    content_text: "",
    content_redacted: input.reason ?? "redacted",
    pii_flags: normalizeStringArray(input.pii_flags ?? ["redacted"]),
    refs: [input.redacts_entry_id],
  });

export const canAccessThread = (thread, requester) => {
  if (!thread || !requester?.owner_id) return false;
  if (thread.scope === THREAD_SCOPE.PUBLIC) return true;
  if (thread.scope === THREAD_SCOPE.PRIVATE) return requester.owner_id === thread.owner_id;
  if (thread.scope === THREAD_SCOPE.POD_PRIVATE) {
    if (requester.owner_id === thread.owner_id) return true;
    return Array.isArray(requester.pod_ids) && requester.pod_ids.includes(thread.owner_id);
  }
  return false;
};

export const retrieveThreadContext = (state, request) => {
  const limit = Math.max(0, Number(request?.limit ?? 0));
  const thread = state.threads.find((item) => item.thread_id === request?.thread_id);
  if (!thread) return { ok: false, reason: "thread_not_found", entries: [] };
  if (!canAccessThread(thread, request?.requester)) return { ok: false, reason: "scope_violation", entries: [] };

  const ordered = getThreadEntriesOrdered(state.entries, thread.thread_id);
  const sliceStart = limit > 0 ? Math.max(0, ordered.length - limit) : ordered.length;
  const entries = ordered.slice(sliceStart);
  const snapshot = request?.include_snapshot ? getLatestSnapshot(state.snapshots, thread.thread_id) : null;

  return { ok: true, thread, entries, snapshot };
};

export const getThreadEntriesPage = (state, request) => {
  const limit = Math.max(1, Number(request?.limit ?? 1));
  const thread = state.threads.find((item) => item.thread_id === request?.thread_id);
  if (!thread) return { ok: false, reason: "thread_not_found", entries: [], nextCursor: null };
  if (!canAccessThread(thread, request?.requester)) {
    return { ok: false, reason: "scope_violation", entries: [], nextCursor: null };
  }

  const ordered = getThreadEntriesOrdered(state.entries, thread.thread_id);
  let endIndex = ordered.length - 1;

  if (request?.cursor) {
    const cursorIndex = ordered.findIndex((entry) => entry.entry_id === request.cursor);
    if (cursorIndex === -1) {
      return { ok: false, reason: "cursor_not_found", entries: [], nextCursor: null };
    }
    endIndex = cursorIndex - 1;
  }

  if (endIndex < 0) return { ok: true, entries: [], nextCursor: null };

  const startIndex = Math.max(0, endIndex - limit + 1);
  const entries = ordered.slice(startIndex, endIndex + 1);
  const nextCursor = startIndex > 0 ? ordered[startIndex].entry_id : null;

  return { ok: true, entries, nextCursor };
};
