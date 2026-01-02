import { execSync } from "node:child_process";

const input = process.argv[2];
const envUrl = process.env.WHOAMI_URL || process.env.VERCEL_URL;

const resolveBase = () => {
  if (input) return input;
  if (envUrl) {
    if (envUrl.startsWith("http")) return envUrl;
    return `https://${envUrl}`;
  }
  return "https://pipe-profit-pilot.vercel.app";
};

const ensureBuildUrl = (base) => {
  const trimmed = base.replace(/\/+$/, "");
  if (trimmed.endsWith("/api/build")) return trimmed;
  return `${trimmed}/api/build`;
};

const url = ensureBuildUrl(resolveBase());

const getLocalCommit = () => {
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
};

const run = async () => {
  const response = await fetch(url, { method: "GET" });
  const raw = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!parsed) {
    console.error(`[whoami] non-json response (${response.status}) from ${url}`);
    console.error(raw);
    process.exit(1);
  }

  const localCommit = getLocalCommit();
  const remoteCommit = parsed?.build?.commitSha ?? null;
  const match = Boolean(localCommit && remoteCommit && localCommit === remoteCommit);

  const report = {
    ok: parsed?.ok === true,
    deployment: parsed,
    local: {
      commit: localCommit,
    },
    match,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exit(2);
  }
  if (localCommit && remoteCommit && !match) {
    process.exit(3);
  }
};

run().catch((error) => {
  console.error("[whoami] request failed", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
