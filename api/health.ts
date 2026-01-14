import { jsonErr, jsonOk, safeHandler, type ApiRequest, type ApiResponse } from "../src/kernel/apiJson.js";
import { ErrorCode } from "../src/kernel/errorCodes.js";
import { KERNEL_VERSION } from "../src/kernel/version.js";

export const config = { runtime: "nodejs" };

const getSha = () =>
  process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null;

const buildHealthPayload = () => ({
  service: "march-project",
  kernelVersion: KERNEL_VERSION,
  ts: new Date().toISOString(),
  status: "ok",
  sha: getSha(),
});

const handler = async (req: ApiRequest, res: ApiResponse) => {
  const method = req.method?.toUpperCase() || "GET";
  if (method !== "GET" && method !== "HEAD") {
    jsonErr(res, 405, ErrorCode.METHOD_NOT_ALLOWED, "method_not_allowed");
    return;
  }

  jsonOk(res, buildHealthPayload());
};

export default safeHandler(handler);
