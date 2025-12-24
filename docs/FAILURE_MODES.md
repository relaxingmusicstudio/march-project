# Failure Modes (How We Break Safely)

Each scenario lists:
- What breaks
- Safe degradation
- Recovery path

## 1) Founder disappears
- What breaks: no clear intent-owner for priorities; operations drift.
- Safe degradation: block execution without explicit intent; default to read-only status + maintenance mode.
- Recovery: transfer authority by explicit human override; re-declare intent and constraints.

## 2) Majority becomes greedy ("growth at all costs")
- What breaks: pressure to optimize prohibited targets (engagement/manipulation/coercion).
- Safe degradation: policy engine rejects prohibited optimization targets; preflight blocks shipping.
- Recovery: re-align goals to allowed axes; document tradeoffs; re-run preflight.

## 3) AI becomes smarter than the operator
- What breaks: the temptation to outsource intent/judgment.
- Safe degradation: enforce "intent before action" and "human supremacy" invariants; require explicit intent envelopes.
- Recovery: redesign workflows to keep the human as the normative authority; audit for bypass paths.

## 4) Economic crash / demand collapse
- What breaks: business assumptions, funnel performance, and timelines.
- Safe degradation: reduce automation; focus on truthful reporting + survival actions; do not fabricate certainty.
- Recovery: re-onboard strategic assumptions; re-plan checklist; re-establish operating cadence.

## 5) Political capture attempt
- What breaks: incentives shift toward censorship, coercion, or surveillance.
- Safe degradation: refuse forbidden optimizations; keep logs/auditability; allow operator to fork/exit.
- Recovery: remove capture vectors; rotate keys/roles; publish constraints and governance boundaries.

## 6) Misinformation attack (external)
- What breaks: operator confidence; decision quality; brand trust.
- Safe degradation: prioritize verification and provenance; avoid amplifying unverified claims; show uncertainty.
- Recovery: collect evidence; update playbooks; add detection hooks to maintenance reporting.

## 7) Mass non-participation (users ignore recommendations)
- What breaks: feedback loops; perceived usefulness; habit formation.
- Safe degradation: do not gamify engagement; reduce to "one clear action" plus rationale; minimize cognitive load.
- Recovery: improve clarity; shorten loops; re-validate onboarding quality and checklist alignment.

## 8) Runaway success (hypergrowth)
- What breaks: operational load; governance shortcuts; quality regressions.
- Safe degradation: enforce preflight and append-only audit rules; slow shipping when drift increases.
- Recovery: add capacity via process/automation with explicit intent; expand guardrails before expanding features.

