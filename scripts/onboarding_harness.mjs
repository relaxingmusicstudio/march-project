import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const onboardingPath = resolve(root, "src", "lib", "onboarding.ts");
const loaderUrl = pathToFileURL(resolve(root, "scripts", "ts-loader.mjs")).href;

const inline = `
  import { buildOnboardingState, ONBOARDING_TOTAL_STEPS } from ${JSON.stringify(pathToFileURL(onboardingPath).href)};

  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  const empty = buildOnboardingState({}, 0, null);
  assert(empty.status === "not_started", "empty state should be not_started");

  const stepOne = buildOnboardingState({ businessName: "Acme HVAC" }, 1, null);
  assert(stepOne.status === "in_progress", "step 1 should be in_progress");

  const complete = buildOnboardingState({ businessName: "Acme HVAC" }, ONBOARDING_TOTAL_STEPS, null);
  assert(complete.status === "complete", "total steps should be complete");

  console.log("onboarding_harness_ok");
`;

const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--experimental-loader", loaderUrl, "--input-type=module", "-e", inline],
  { encoding: "utf8" }
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
