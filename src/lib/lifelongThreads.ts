import {
  THREAD_SCOPE,
  THREAD_AUTHOR_TYPE,
  createThreadStoreState as createThreadStoreStateCore,
  advanceClock as advanceClockCore,
  getThreadEntriesOrdered as getThreadEntriesOrderedCore,
  buildThreadSnapshot as buildThreadSnapshotCore,
  saveThreadSnapshot as saveThreadSnapshotCore,
  getLatestSnapshot as getLatestSnapshotCore,
  getThreadSummary as getThreadSummaryCore,
  createThread as createThreadCore,
  appendThreadEntry as appendThreadEntryCore,
  appendRedactionEntry as appendRedactionEntryCore,
  canAccessThread as canAccessThreadCore,
  retrieveThreadContext as retrieveThreadContextCore,
  getThreadEntriesPage as getThreadEntriesPageCore,
} from "./lifelongThreadsCore.js";

export type ThreadScope = (typeof THREAD_SCOPE)[keyof typeof THREAD_SCOPE];
export const ThreadScope = THREAD_SCOPE;

export type ThreadAuthorType = (typeof THREAD_AUTHOR_TYPE)[keyof typeof THREAD_AUTHOR_TYPE];
export const ThreadAuthorType = THREAD_AUTHOR_TYPE;

export type Thread = {
  thread_id: string;
  owner_id: string;
  scope: ThreadScope;
  created_at: string;
  updated_at: string;
};

export type ThreadEntry = {
  entry_id: string;
  thread_id: string;
  author_type: ThreadAuthorType;
  intent_id?: string;
  created_at: string;
  content_text: string;
  content_redacted?: string;
  pii_flags?: string[];
  refs?: string[];
};

export type ThreadSnapshotSummaryFields = {
  entry_count: number;
  redacted_count: number;
  last_updated: string;
};

export type ThreadSnapshot = {
  thread_id: string;
  snapshot_version: string;
  latest_entry_id: string | null;
  digest: string;
  summary_fields: ThreadSnapshotSummaryFields;
  created_at: string;
};

export type ThreadStoreState = {
  threads: Thread[];
  entries: ThreadEntry[];
  snapshots: ThreadSnapshot[];
  logicalClock: number;
};

export type ThreadAccessContext = {
  owner_id: string;
  pod_ids?: string[];
};

export type ThreadCreateInput = {
  thread_id?: string;
  owner_id: string;
  scope?: ThreadScope;
  created_at?: string;
  updated_at?: string;
};

export type ThreadEntryInput = {
  entry_id?: string;
  thread_id: string;
  author_type: ThreadAuthorType;
  intent_id?: string;
  created_at?: string;
  content_text?: string;
  content_redacted?: string;
  pii_flags?: string[];
  refs?: string[];
};

export type ThreadRedactionInput = {
  thread_id: string;
  redacts_entry_id: string;
  author_type?: ThreadAuthorType;
  intent_id?: string;
  reason?: string;
  pii_flags?: string[];
};

export type ThreadContextRequest = {
  thread_id: string;
  requester: ThreadAccessContext;
  limit: number;
  include_snapshot?: boolean;
};

export type ThreadContextResult = {
  ok: boolean;
  reason?: string;
  thread?: Thread;
  entries: ThreadEntry[];
  snapshot?: ThreadSnapshot | null;
};

export type ThreadPageRequest = {
  thread_id: string;
  requester: ThreadAccessContext;
  limit: number;
  cursor?: string | null;
};

export type ThreadPageResult = {
  ok: boolean;
  reason?: string;
  entries: ThreadEntry[];
  nextCursor: string | null;
};

export const createThreadStoreState: (seed?: Partial<ThreadStoreState>) => ThreadStoreState = createThreadStoreStateCore;
export const advanceClock: (state: ThreadStoreState) => { state: ThreadStoreState; value: string } = advanceClockCore;
export const getThreadEntriesOrdered: (entries: ThreadEntry[], threadId: string) => ThreadEntry[] = getThreadEntriesOrderedCore;
export const buildThreadSnapshot: (threadId: string, entries: ThreadEntry[], createdAtOverride?: string) => ThreadSnapshot =
  buildThreadSnapshotCore;
export const saveThreadSnapshot: (state: ThreadStoreState, snapshot: ThreadSnapshot) => ThreadStoreState = saveThreadSnapshotCore;
export const getLatestSnapshot: (snapshots: ThreadSnapshot[], threadId: string) => ThreadSnapshot | null = getLatestSnapshotCore;
export const getThreadSummary: (
  threadId: string,
  entries: ThreadEntry[],
  snapshot?: ThreadSnapshot | null
) => ThreadSnapshotSummaryFields = getThreadSummaryCore;
export const createThread: (state: ThreadStoreState, input: ThreadCreateInput) => { state: ThreadStoreState; thread: Thread } =
  createThreadCore;
export const appendThreadEntry: (state: ThreadStoreState, input: ThreadEntryInput) => { state: ThreadStoreState; entry: ThreadEntry } =
  appendThreadEntryCore;
export const appendRedactionEntry: (state: ThreadStoreState, input: ThreadRedactionInput) => { state: ThreadStoreState; entry: ThreadEntry } =
  appendRedactionEntryCore;
export const canAccessThread: (thread: Thread, requester: ThreadAccessContext) => boolean = canAccessThreadCore;
export const retrieveThreadContext: (state: ThreadStoreState, request: ThreadContextRequest) => ThreadContextResult =
  retrieveThreadContextCore;
export const getThreadEntriesPage: (state: ThreadStoreState, request: ThreadPageRequest) => ThreadPageResult =
  getThreadEntriesPageCore;
