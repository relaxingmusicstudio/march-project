import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const searchPath = resolve(root, "api", "search-decision.ts");
const resolvePath = resolve(root, "api", "resolve-decision.ts");
const loaderUrl = pathToFileURL(resolve(root, "scripts", "ts-loader.mjs")).href;

const inline = `
  import searchHandler from ${JSON.stringify(pathToFileURL(searchPath).href)};
  import resolveHandler from ${JSON.stringify(pathToFileURL(resolvePath).href)};

  const createMockRes = () => {
    let body = "";
    const headers = new Map();
    const res = {
      statusCode: 200,
      setHeader: (name, value) => {
        headers.set(String(name).toLowerCase(), Array.isArray(value) ? value.join(", ") : String(value));
      },
      end: (chunk) => {
        if (chunk) {
          body += typeof chunk === "string" ? chunk : String(chunk);
        }
      },
    };
    return {
      res,
      getBody: () => body,
      getStatus: () => res.statusCode,
    };
  };

  const unwrapPayload = (payload) => {
    if (payload && typeof payload === "object") {
      const data = payload.data;
      if (data && typeof data === "object") return data;
    }
    return payload;
  };

  const expectNoop = (payload) => {
    const target = unwrapPayload(payload);
    if (!target || target.noop !== true) {
      throw new Error("Expected noop:true for minimal calibration case");
    }
  };

  const expectNotBlocked = (payload) => {
    const target = unwrapPayload(payload);
    const calibration =
      target?.calibration || target?.decision?.calibration || payload?.calibration || payload?.decision?.calibration;
    if (!calibration) {
      throw new Error("Missing calibration in response");
    }
    if (calibration.block === true || calibration.calibration_label === "blocked") {
      throw new Error("Expected calibration not blocked for rich case");
    }
  };

  const call = async (label, handler, body, { assertNoop = false, assertNotBlocked = false } = {}) => {
    const req = { method: "POST", body };
    const mock = createMockRes();
    await handler(req, mock.res);
    const raw = mock.getBody();
    console.log("----- " + label + " -----");
    console.log(raw);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(label + ": response not JSON");
    }
    if (assertNoop) expectNoop(parsed);
    if (assertNotBlocked) expectNotBlocked(parsed);
  };

  await call("search-minimal", searchHandler, { query: "ping", mode: "live" }, { assertNoop: true });
  await call("search-rich", searchHandler, { query: "ping", mode: "mock", context: "signals present" }, { assertNotBlocked: true });
  await call("resolve-minimal", resolveHandler, { query: "ping" }, { assertNoop: true });
  await call(
    "resolve-rich",
    resolveHandler,
    { query: "ping", context: "Field notes: validated constraints and budget." },
    { assertNotBlocked: true }
  );
`;

const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--experimental-loader", loaderUrl, "--input-type=module", "-e", inline],
  { encoding: "utf8" }
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
