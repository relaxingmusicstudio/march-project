#!/usr/bin/env node

const { execSync } = require("child_process");
const run = (cmd, opts = {}) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
};

const withMockEnv = { env: { ...process.env, VITE_MOCK_AUTH: "true" } };

try {
  // Optional: npm ci (kept for consistency)
  run("npm ci");

  // Build + tests in mock mode
  run("npm run build", withMockEnv);
  run("npm run test:e2e", withMockEnv);
  run("npm run ops:doctor", withMockEnv);

  // Collect metadata for PR template
  const commit = execSync("git rev-parse HEAD").toString().trim();
  const branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
  let files;
  try {
    files = execSync("git diff --name-only origin/main...HEAD").toString().trim();
    if (!files) throw new Error("empty");
  } catch {
    files = execSync("git diff --name-only HEAD~1..HEAD").toString().trim();
  }


} catch (err) {
  console.error("\nRelease gate failed:", err?.message || err);
  process.exit(1);
}
