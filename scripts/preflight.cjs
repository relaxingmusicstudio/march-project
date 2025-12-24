#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");

const run = (cmd, opts = {}) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
};

const REQUIRED_ENV_VARS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
const OPTIONAL_ENV_VARS = [
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "LLM_ALLOW_DEMO_KEYS",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "VITE_STRIPE_PUBLISHABLE_KEY",
];

const requiredDocs = [
  "docs/CIV_CONSTITUTION.md",
  "docs/FAILURE_MODES.md",
  "docs/MAINTENANCE_REPORT_SCHEMA.md",
  "docs/EVOLUTION_CONTRACT.md",
  "docs/RISK_REGISTER.md",
];

const isMockMode = () => String(process.env.VITE_MOCK_AUTH || "").toLowerCase() === "true";

const getMissingVars = (names) =>
  names.filter((name) => !process.env[name] || String(process.env[name]).trim().length === 0);

const parseDeclaredTargets = () => {
  const raw = process.env.PPP_DECLARED_OPTIMIZATION_TARGETS;
  if (!raw || typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim()) : [];
    } catch {
      return [];
    }
  }
  return trimmed
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
};

const checkDocs = () => {
  const missing = requiredDocs.filter((p) => !fs.existsSync(p));
  if (missing.length) {
    throw new Error(`Missing required docs:\n- ${missing.join("\n- ")}`);
  }
};

const buildReadinessSummary = () => {
  const mode = isMockMode() ? "MOCK" : "REAL";
  const missingRequired = getMissingVars(REQUIRED_ENV_VARS);
  const missingOptional = getMissingVars(OPTIONAL_ENV_VARS);
  const status = mode === "MOCK" ? "WARN" : missingRequired.length > 0 ? "FAIL" : "PASS";
  const humanApprovalRequired = status === "PASS" ? "NO" : "YES";
  const nextActions = [];
  const warnings = [];

  const reachabilityChannel = process.env.PPP_PREFLIGHT_CHANNEL;
  const phoneType = process.env.PPP_PREFLIGHT_PHONE_TYPE;
  if (reachabilityChannel === "sms" && (phoneType === "landline" || phoneType === "unknown")) {
    warnings.push("SMS blocked for landline/unknown phone type.");
  }

  if (mode === "REAL" && process.env.PPP_PREFLIGHT_MISSING_RESPONSE_ID === "true") {
    warnings.push("Outbound action missing provider response_id will SAFE_HOLD.");
  }

  missingRequired.forEach((name) => nextActions.push(`Set ${name}`));
  if (mode === "MOCK") {
    nextActions.push("Switch to REAL mode to enforce required env");
  }
  if (missingRequired.length === 0 && missingOptional.length > 0) {
    missingOptional.forEach((name) => nextActions.push(`Optional: set ${name}`));
  }
  if (nextActions.length === 0) {
    nextActions.push("Proceed with pilot run");
  }
  warnings.forEach((warning) => nextActions.push(`Warning: ${warning}`));

  return {
    status,
    mode,
    missingRequired,
    missingOptional,
    humanApprovalRequired,
    nextActions,
  };
};

const printReadinessSummary = (summary) => {
  console.log("\nPilot Readiness Summary");
  console.log(`Status: ${summary.status}`);
  console.log(`Mode: ${summary.mode}`);
  console.log(`MissingRequired: ${JSON.stringify(summary.missingRequired)}`);
  console.log(`MissingOptional: ${JSON.stringify(summary.missingOptional)}`);
  console.log(`HumanApprovalRequired: ${summary.humanApprovalRequired}`);
  console.log(`NextActions: ${JSON.stringify(summary.nextActions)}`);
};

async function checkDeclaredTargets() {
  const declaredTargets = parseDeclaredTargets();
  if (!declaredTargets.length) return;

  const { evaluatePolicy } = await import("../src/lib/policy/policyEngineCore.js");
  const result = evaluatePolicy({
    featureName: "preflight",
    declaredOptimizationTargets: declaredTargets,
    intentsPresent: true,
    appendOnlyPreserved: true,
    requiresHumanApprovalForR3: true,
  });

  if (!result.ok) {
    console.error("\nPreflight policy BLOCK:");
    for (const v of result.violations || []) console.error(`- ${v.id}: ${v.message}`);
    process.exit(1);
  }
}

async function main() {
  checkDocs();
  run("node scripts/policy-selftest.cjs", { env: { ...process.env } });
  run("node scripts/threads-selftest.cjs", { env: { ...process.env } });
  run("node scripts/maintenance-bot-selftest.cjs", { env: { ...process.env } });
  run("node scripts/irreversibility-selftest.cjs", { env: { ...process.env } });
  run("node scripts/history-kernel-selftest.cjs", { env: { ...process.env } });
  run("node scripts/failure-simulation-selftest.cjs", { env: { ...process.env } });
  run("node scripts/stewardship-selftest.cjs", { env: { ...process.env } });
  await checkDeclaredTargets();

  const readiness = buildReadinessSummary();
  printReadinessSummary(readiness);

  if (readiness.status === "FAIL") {
    console.log("\nPreflight: FAIL");
    process.exit(1);
  }

  console.log(`\nPreflight: ${readiness.status === "WARN" ? "WARN" : "GREEN"}`);
}

main().catch((err) => {
  console.error("\nPreflight failed:", err?.message || err);
  process.exit(1);
});
