#!/usr/bin/env node

const assert = require("node:assert/strict");

async function main() {
  const {
    HISTORY_DOMAIN,
    HISTORY_SOURCE_TYPE,
    HISTORY_ADDED_BY,
    createHistoryState,
    appendHistoryClaim,
    appendHistoryChallenge,
    queryHistoryClaims,
    evaluateHistoryUsage,
  } = await import("../src/lib/historyKernelCore.js");

  const base = createHistoryState();

  const validClaim = appendHistoryClaim(base, {
    claim_text: "In 2008-2009, global GDP contracted after a financial crisis.",
    time_range: "2008-2009",
    geography: "global",
    domain: HISTORY_DOMAIN.ECONOMICS,
    sources: [
      { author: "IMF", type: HISTORY_SOURCE_TYPE.DATA, date: "2009" },
      { author: "Academic Review", type: HISTORY_SOURCE_TYPE.SECONDARY, date: "2010" },
    ],
    counter_sources: [],
    evidence_grade: "A",
    confidence_score: 0.9,
    controversy_score: 0.2,
    added_by: HISTORY_ADDED_BY.CURATOR,
    writer_role: HISTORY_ADDED_BY.CURATOR,
    added_at: "h1",
    falsifiable_prompt: "Data revisions showing positive GDP growth in all quarters of 2008-2009.",
  });

  assert.equal(base.claims.length, 0, "Append-only: base state must not be mutated.");
  assert.equal(validClaim.state.claims.length, 1, "Append-only: claim should be appended.");

  let controversyError = null;
  try {
    appendHistoryClaim(validClaim.state, {
      claim_text: "Some dispute the causes of the 2008 financial crisis.",
      time_range: "2008-2010",
      geography: "global",
      domain: HISTORY_DOMAIN.ECONOMICS,
      sources: [
        { author: "Primary Archive", type: HISTORY_SOURCE_TYPE.PRIMARY, date: "2009" },
        { author: "Secondary Review", type: HISTORY_SOURCE_TYPE.SECONDARY, date: "2011" },
      ],
      counter_sources: [],
      evidence_grade: "B",
      confidence_score: 0.6,
      controversy_score: 0.6,
      added_by: HISTORY_ADDED_BY.CURATOR,
      writer_role: HISTORY_ADDED_BY.CURATOR,
      added_at: "h2",
      falsifiable_prompt: "Discovery of a definitive causal chain accepted by all sources.",
    });
  } catch (err) {
    controversyError = err;
  }
  assert.ok(controversyError, "Counter sources are required when controversy is high.");

  let secondaryError = null;
  try {
    appendHistoryClaim(validClaim.state, {
      claim_text: "Early computing used mechanical relays before transistors.",
      time_range: "1930-1950",
      geography: "US",
      domain: HISTORY_DOMAIN.TECH,
      sources: [{ author: "Archive", type: HISTORY_SOURCE_TYPE.PRIMARY, date: "1950" }],
      counter_sources: [],
      evidence_grade: "B",
      confidence_score: 0.7,
      controversy_score: 0.1,
      added_by: HISTORY_ADDED_BY.CURATOR,
      writer_role: HISTORY_ADDED_BY.CURATOR,
      added_at: "h3",
      falsifiable_prompt: "Primary documentation showing transistor use before relay systems.",
    });
  } catch (err) {
    secondaryError = err;
  }
  assert.ok(secondaryError, "Secondary source requirement must be enforced.");

  const challenged = appendHistoryChallenge(validClaim.state, {
    claim_text: "Some analysts argue the contraction varied significantly by region.",
    time_range: "2008-2009",
    geography: "global",
    domain: HISTORY_DOMAIN.ECONOMICS,
    sources: [
      { author: "Regional Study", type: HISTORY_SOURCE_TYPE.SECONDARY, date: "2012" },
      { author: "World Bank", type: HISTORY_SOURCE_TYPE.DATA, date: "2011" },
    ],
    counter_sources: [],
    evidence_grade: "B",
    confidence_score: 0.6,
    controversy_score: 0.2,
    added_by: HISTORY_ADDED_BY.CURATOR,
    writer_role: HISTORY_ADDED_BY.CURATOR,
    added_at: "h4",
    falsifiable_prompt: "Uniform contraction metrics across all regions.",
    challenge_of: validClaim.claim.claim_id,
  });
  assert.equal(challenged.state.claims.length, 2, "Challenges must append a new claim.");
  assert.equal(validClaim.state.claims[0].claim_text, validClaim.claim.claim_text, "Original claim remains intact.");

  const queryDenied = queryHistoryClaims(validClaim.state, { explicit_query: false, intent_id: "" });
  assert.equal(queryDenied.ok, false, "History queries require explicit intent.");

  const ceoUsage = evaluateHistoryUsage({
    explicit_intent: false,
    purpose: "context",
    requested_by: "ceo_pilot",
  });
  assert.equal(ceoUsage.ok, false, "CEO Pilot cannot use history without explicit intent.");

  console.log("History kernel selftest: PASS");
}

main().catch((err) => {
  console.error("\nHistory kernel selftest: FAIL");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
