#!/usr/bin/env node

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

async function main() {
  const {
    THREAD_SCOPE,
    THREAD_AUTHOR_TYPE,
    createThreadStoreState,
    createThread,
    appendThreadEntry,
    appendRedactionEntry,
    buildThreadSnapshot,
    retrieveThreadContext,
  } = await import("../src/lib/lifelongThreadsCore.js");

  let store = createThreadStoreState();

  const threadResult = createThread(store, {
    owner_id: "owner-a",
    scope: THREAD_SCOPE.PRIVATE,
    created_at: "t1",
  });
  store = threadResult.state;

  const entryResult = appendThreadEntry(store, {
    thread_id: threadResult.thread.thread_id,
    author_type: THREAD_AUTHOR_TYPE.USER,
    content_text: "secret payload",
    created_at: "t2",
  });
  store = entryResult.state;

  const redactionResult = appendRedactionEntry(store, {
    thread_id: threadResult.thread.thread_id,
    redacts_entry_id: entryResult.entry.entry_id,
    reason: "remove pii",
  });
  store = redactionResult.state;

  assert.equal(store.entries.length, 2, "Append-only: entries should grow when redaction is added.");
  assert.equal(store.entries[0].content_text, "secret payload", "Append-only: original entry must remain unchanged.");
  assert.ok(
    store.entries[1].refs?.includes(entryResult.entry.entry_id),
    "Redaction entry must reference the redacted entry."
  );

  const snapshotA = buildThreadSnapshot(threadResult.thread.thread_id, store.entries, "t9");
  const snapshotB = buildThreadSnapshot(threadResult.thread.thread_id, store.entries.slice().reverse(), "t9");
  assert.equal(snapshotA.digest, snapshotB.digest, "Snapshot digest must be stable for identical entries.");

  const privateAccess = retrieveThreadContext(store, {
    thread_id: threadResult.thread.thread_id,
    requester: { owner_id: "owner-b" },
    limit: 10,
    include_snapshot: false,
  });
  assert.equal(privateAccess.ok, false, "Private threads must not be readable by other owners.");

  const podThread = createThread(store, {
    owner_id: "pod-alpha",
    scope: THREAD_SCOPE.POD_PRIVATE,
    created_at: "t3",
  });
  store = podThread.state;

  const podDenied = retrieveThreadContext(store, {
    thread_id: podThread.thread.thread_id,
    requester: { owner_id: "owner-b", pod_ids: ["pod-beta"] },
    limit: 5,
  });
  assert.equal(podDenied.ok, false, "POD_PRIVATE must deny access outside the pod.");

  const podAllowed = retrieveThreadContext(store, {
    thread_id: podThread.thread.thread_id,
    requester: { owner_id: "owner-b", pod_ids: ["pod-alpha"] },
    limit: 5,
  });
  assert.equal(podAllowed.ok, true, "POD_PRIVATE must allow access inside the pod.");

  const publicThread = createThread(store, {
    owner_id: "owner-public",
    scope: THREAD_SCOPE.PUBLIC,
    created_at: "t4",
  });
  store = publicThread.state;

  const publicAccess = retrieveThreadContext(store, {
    thread_id: publicThread.thread.thread_id,
    requester: { owner_id: "owner-b" },
    limit: 1,
  });
  assert.equal(publicAccess.ok, true, "PUBLIC threads must be accessible across owners.");

  const healthSource = readFileSync(resolve(__dirname, "..", "api", "health.ts"), "utf8");
  assert.ok(healthSource.includes('service: "march-project"'), "Health must include service name.");
  assert.ok(healthSource.includes("kernelVersion"), "Health must include kernel version.");
  assert.ok(healthSource.includes("jsonOk"), "Health must return JSON via jsonOk.");

  const chatSource = readFileSync(resolve(__dirname, "..", "api", "chat.ts"), "utf8");
  assert.ok(chatSource.includes("needsConfig: true"), "Chat mock must signal needsConfig.");
  assert.ok(chatSource.includes("needsConfig: false"), "Chat configured path must clear needsConfig.");
  assert.ok(chatSource.includes("https://api.openai.com/v1/chat/completions"), "Chat must call OpenAI.");

  console.log("Threads selftest: PASS");
}

main().catch((err) => {
  console.error("\nThreads selftest: FAIL");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
