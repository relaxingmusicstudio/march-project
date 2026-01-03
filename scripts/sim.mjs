import fs from "node:fs";
import path from "node:path";
import { DEFAULT_ASSUMPTIONS, createRng } from "../lib/sim/types.js";
import { simulateRun } from "../lib/sim/model.js";
import { summarizeRuns } from "../lib/sim/metrics.js";
import { detectGaps, evaluateFailClosed } from "../lib/sim/gaps.js";

function parseArgs(argv) {
  const args = {};
  for (const entry of argv) {
    if (!entry.startsWith("--")) continue;
    const [key, rawValue] = entry.slice(2).split("=");
    if (!rawValue) {
      args[key] = true;
      continue;
    }
    if (["runs", "years", "seed"].includes(key)) {
      args[key] = Number.parseInt(rawValue, 10);
      continue;
    }
    if (key === "out") {
      args.out = rawValue;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const runs =
  Number.isFinite(args.runs) && args.runs > 0 ? args.runs : 500;
const years =
  Number.isFinite(args.years) && args.years > 0 ? args.years : 50;
const seed =
  Number.isFinite(args.seed) && args.seed > 0 ? args.seed : 12345;
const outFile = args.out ?? "reports/sim-report.json";

const assumptions = JSON.parse(JSON.stringify(DEFAULT_ASSUMPTIONS));
const config = {
  runs,
  years,
  seed,
  scenarios: {
    inflation_shift: true,
    recession: true,
    fraud: true,
    governance: true,
    rails: true,
    catastrophe: true,
    regulatory: true,
  },
};

const runResults = [];
for (let i = 0; i < runs; i += 1) {
  const runSeed = (seed + i * 10007) >>> 0;
  const rng = createRng(runSeed);
  runResults.push(simulateRun(rng, config, assumptions));
}

const summary = summarizeRuns(runResults, {
  fraudLossThreshold: assumptions.fraud_loss_rate_threshold,
});
const gap_flags = detectGaps(summary.results, summary.top_failure_modes);
const failCheck = evaluateFailClosed(
  summary.results,
  summary.top_failure_modes,
);

const notes = ["Deterministic seed; rerun with same seed yields same report."];
for (const reason of failCheck.reasons) {
  notes.push(`fail_closed:${reason}`);
}

const report = {
  ok: failCheck.ok,
  ts: new Date().toISOString(),
  runs,
  years,
  seed,
  assumptions,
  results: summary.results,
  top_failure_modes: summary.top_failure_modes,
  gap_flags,
  notes,
};

const output = `${JSON.stringify(report, null, 2)}\n`;
const outPath = path.resolve(process.cwd(), outFile);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, output, "utf8");
process.stdout.write(output);

if (!report.ok) {
  process.exitCode = 1;
}
