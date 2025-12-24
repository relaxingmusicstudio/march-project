#!/usr/bin/env node

const { execSync } = require("child_process");

const run = (cmd, opts = {}) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
};

const withMockEnv = { env: { ...process.env, VITE_MOCK_AUTH: "true" } };

try {
  run("npm run preflight", withMockEnv);
  run("npm run build", withMockEnv);
  run("npm run test:e2e", withMockEnv);
  run("npm run ops:doctor", withMockEnv);

  console.log("\nProof gate: GREEN");
} catch (err) {
  console.error("\nProof gate failed:", err?.message || err);
  process.exit(1);
}
