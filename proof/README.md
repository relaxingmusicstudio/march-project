# Proof Pipeline

Run proof checks from repo root:

1) `npm run proof:quick`
2) `npm run proof:full`

Artifacts are written to:
- `proof/latest/proof.md`
- `proof/latest/proof.json`
- `proof/latest/raw/*.txt`

Notes:
- `proof:quick` is intended for 30-90s checks.
- `proof:full` includes lint/typecheck/tests/build and deeper DB checks.

Dev server API smoke:
- Set `DEV_BASE_URL` if your dev server uses a non-default port.
  PowerShell example: `$env:DEV_BASE_URL="http://localhost:8080"`
- Run `npm run dev` in one terminal, then `npm run proof:quick` in another.
- Expected `/api/health` output:
  `{"status":"ok","sha":"<git sha or null>"}`
