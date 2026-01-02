const input = process.argv[2];
const envUrl = process.env.AUDIT_URL || process.env.VERCEL_URL;

const resolveBase = () => {
  if (input) return input;
  if (envUrl) {
    if (envUrl.startsWith("http")) return envUrl;
    return `https://${envUrl}`;
  }
  return "https://pipe-profit-pilot.vercel.app";
};

const ensureAuditUrl = (base) => {
  const trimmed = base.replace(/\/+$/, "");
  if (trimmed.endsWith("/api/audit/run")) return trimmed;
  return `${trimmed}/api/audit/run`;
};

const url = ensureAuditUrl(resolveBase());

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
    console.error(`[audit] non-json response (${response.status}) from ${url}`);
    console.error(raw);
    process.exit(1);
  }
  console.log(JSON.stringify(parsed, null, 2));
  if (!parsed.ok) {
    process.exit(2);
  }
};

run().catch((error) => {
  console.error("[audit] request failed", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
