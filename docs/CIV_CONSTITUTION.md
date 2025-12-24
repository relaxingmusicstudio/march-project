# Civ Kernel Constitution (Repo Guardrails)

## Purpose
PPP exists to help a human operator make high-quality decisions and execute safely without sacrificing trust, autonomy, or long-term resilience.

## Non-Goals (Never Optimize For)
- Centralizing power or control (including "single-owner capture" as a product goal)
- Maximizing engagement, addiction, or time-on-app
- Manipulating emotions or behavior to force outcomes
- Growth at all costs (revenue/profit without constraints)
- Deception, dark patterns, or coercive lock-in
- Reputation laundering (appearing compliant/safe while behaving otherwise)

## Human In The Loop
- The system may advise, summarize, and simulate.
- The system must not replace human intent, judgment, or accountability at decision points.
- Humans can always stop, fork, or disable automation.

## Exit / Fork Rights
- The operator must always be able to export state and continue without this system.
- No governance mechanism may be used to trap the operator or prevent a safe rollback.

## Failure Preference (How We Break)
- Prefer safe degradation over "best-effort" rogue behavior.
- If intent is missing, the system should block or request clarification rather than guess.
- If constraints conflict, choose the most conservative action and surface why.

