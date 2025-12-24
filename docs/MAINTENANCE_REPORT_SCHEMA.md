# Maintenance Report Schema (v1)

This describes the deterministic, local "Maintenance Report" shape produced by the policy/report layer.
It is intentionally JSON-schema-ish (human readable), not formal JSON Schema.

## Storage / Transport
- Intended for local storage and copy/paste into issues.
- No secrets; no provider keys; no user PII beyond an optional identity label.

## Shape

```jsonc
{
  "version": "v1",
  "generatedAt": "optional string (informational only)",
  "featureName": "string",
  "constitution": {
    "purpose": "string",
    "nonGoals": ["string", "..."]
  },
  "invariants": {
    "requiredIds": ["string", "..."],
    "violations": [{"id": "string", "message": "string"}]
  },
  "policy": {
    "ok": true,
    "violations": [{"id": "string", "message": "string"}],
    "warnings": [{"id": "string", "message": "string"}]
  },
  "drift": {
    "score": 0.0,
    "inputs": {
      "invariantViolationsCount": 0,
      "prohibitedTargetHitsCount": 0,
      "missingIntentCount": 0,
      "missingApprovalCount": 0
    }
  }
}
```

## Interpretation
- Higher drift score is healthier; score is in [0, 1].
- `policy.ok=false` means the report represents a blocked/unsafe change.
- Warnings indicate missing coverage (example: human approval plumbing not fully present) but do not block.

