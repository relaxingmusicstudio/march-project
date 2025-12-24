const freezeInvariant = (invariant) => Object.freeze({ ...invariant });

export const REQUIRED_INVARIANTS = Object.freeze([
  freezeInvariant({
    id: "no_central_control",
    title: "No Central Control",
    description: "The system must not optimize for centralizing power or creating dependency loops.",
    neverOptimizeFor: ["centralize power", "single-owner capture", "forced dependency"],
    violationSignals: ["centralized control path", "operator cannot exit", "coercive gate"],
    enforcement: "Block shipping if changes explicitly optimize for central control or lock-in.",
    safeFailure: "Degrade to read-only and require explicit human override with rationale.",
  }),
  freezeInvariant({
    id: "intent_before_action",
    title: "Intent Before Action",
    description: "Execution and optimization must be justified by declared human intent.",
    neverOptimizeFor: ["automation without intent", "silent execution", "untraceable actions"],
    violationSignals: ["missing intent envelope", "action without reason", "unlogged decision"],
    enforcement: "Block if intent is missing (except explicit mock allowances).",
    safeFailure: "Stop and ask for intent rather than guessing.",
  }),
  freezeInvariant({
    id: "authority_decays_without_contribution",
    title: "Authority Decays Without Contribution",
    description: "Authority is earned through contribution and accountability, not position or proximity.",
    neverOptimizeFor: ["rank/position capture", "credentialism without evidence"],
    violationSignals: ["position-based bypass", "unreviewed authority escalation"],
    enforcement: "Warn when human-approval plumbing is missing; require review for escalations.",
    safeFailure: "Treat escalations as advisory until a human approves.",
  }),
  freezeInvariant({
    id: "knowledge_over_position",
    title: "Knowledge Over Position",
    description: "Prefer evidence and verifiable knowledge over hierarchy or narrative.",
    neverOptimizeFor: ["narrative laundering", "status games", "unverifiable claims"],
    violationSignals: ["claims without evidence", "policy bypass justified by authority"],
    enforcement: "Reject prohibited targets; encourage audit trails and evidence capture.",
    safeFailure: "Surface uncertainty and request verification steps.",
  }),
]);

