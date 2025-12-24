import { test, expect } from "@playwright/test";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runPreflight = (envOverrides: Record<string, string>) => {
  const root = path.resolve(__dirname, "..", "..");
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "preflight.cjs")], {
    cwd: root,
    env: { ...process.env, ...envOverrides },
    encoding: "utf-8",
  });

  return {
    status: typeof result.status === "number" ? result.status : 0,
    output: `${result.stdout || ""}${result.stderr || ""}`,
  };
};

const expectSummary = (output: string, status: string, mode: string) => {
  expect(output).toContain("Pilot Readiness Summary");
  expect(output).toContain(`Status: ${status}`);
  expect(output).toContain(`Mode: ${mode}`);
  expect(output).toContain("MissingRequired:");
  expect(output).toContain("MissingOptional:");
  expect(output).toContain("HumanApprovalRequired:");
  expect(output).toContain("NextActions:");
};

test("preflight warns in mock mode and prints summary", () => {
  const result = runPreflight({
    VITE_MOCK_AUTH: "true",
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_ANON_KEY: "",
  });

  expect(result.status).toBe(0);
  expectSummary(result.output, "WARN", "MOCK");
});

test("preflight fails in real mode when required env missing", () => {
  const result = runPreflight({
    VITE_MOCK_AUTH: "false",
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_ANON_KEY: "",
  });

  expect(result.status).not.toBe(0);
  expectSummary(result.output, "FAIL", "REAL");
});
