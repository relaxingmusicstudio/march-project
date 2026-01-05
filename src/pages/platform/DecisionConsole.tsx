import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, Play, RefreshCw } from "lucide-react";

const API_BASE = "https://pipe-profit-pilot.vercel.app";
const SEARCH_ENDPOINT = `${API_BASE}/api/search-decision`;
const RESOLVE_ENDPOINT = `${API_BASE}/api/resolve-decision`;

const DEFAULT_CONTEXT_JSON = `{"source":"console","business":"Apex HVAC"}`;
const DEFAULT_RESOLVE_JSON = `{"decision_id":"test","action":"ping","context":{"source":"console"}}`;

type ConsoleResponse = {
  endpoint: string;
  status: number;
  durationMs: number;
  timestamp: string;
  payload: Record<string, unknown>;
};

const buildRequestId = () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const safeParseJson = (raw: string, label: string) => {
  if (!raw.trim()) return { ok: true, value: {} as Record<string, unknown> };
  try {
    return { ok: true, value: JSON.parse(raw) as Record<string, unknown> };
  } catch {
    return { ok: false, error: `${label} must be valid JSON` };
  }
};

const extractField = (payload: Record<string, unknown> | null, key: string) => {
  if (!payload) return undefined;
  if (key in payload) return payload[key];
  const data = payload.data;
  if (data && typeof data === "object" && key in data) {
    return (data as Record<string, unknown>)[key];
  }
  return undefined;
};

const extractDecision = (payload: Record<string, unknown> | null) => {
  const decision = extractField(payload, "decision");
  return decision && typeof decision === "object" ? (decision as Record<string, unknown>) : null;
};

const extractCalibration = (payload: Record<string, unknown> | null) => {
  const direct = extractField(payload, "calibration");
  if (direct && typeof direct === "object") return direct as Record<string, unknown>;
  const decision = extractDecision(payload);
  const nested = decision?.calibration;
  if (nested && typeof nested === "object") return nested as Record<string, unknown>;
  return null;
};

const buildClientError = (endpoint: string, message: string): ConsoleResponse => ({
  endpoint,
  status: 0,
  durationMs: 0,
  timestamp: new Date().toLocaleString(),
  payload: {
    ok: false,
    status: 0,
    error: { code: "client_parse_error", message },
    request_id: buildRequestId(),
  },
});

export default function DecisionConsole() {
  const [query, setQuery] = useState("ping");
  const [contextJson, setContextJson] = useState(DEFAULT_CONTEXT_JSON);
  const [resolveJson, setResolveJson] = useState(DEFAULT_RESOLVE_JSON);
  const [output, setOutput] = useState<ConsoleResponse | null>(null);
  const [smokeResults, setSmokeResults] = useState<ConsoleResponse[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSmokeRunning, setIsSmokeRunning] = useState(false);

  const prettyJson = useMemo(() => {
    if (!output?.payload) return "";
    return JSON.stringify(output.payload, null, 2);
  }, [output]);

  const runRequest = async (endpoint: string, body: Record<string, unknown>): Promise<ConsoleResponse> => {
    const start = performance.now();
    const timestamp = new Date().toLocaleString();
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const status = response.status;
      const text = await response.text();
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        payload = {
          ok: false,
          status,
          error: { code: "invalid_json", message: "response_not_json" },
          raw_text: text,
          request_id: buildRequestId(),
        };
      }
      return {
        endpoint,
        status,
        durationMs: Math.round(performance.now() - start),
        timestamp,
        payload,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "network_error";
      return {
        endpoint,
        status: 0,
        durationMs: Math.round(performance.now() - start),
        timestamp,
        payload: {
          ok: false,
          status: 0,
          error: { code: "network_error", message },
          request_id: buildRequestId(),
        },
      };
    }
  };

  const handleSearch = async () => {
    const contextParsed = safeParseJson(contextJson, "Context JSON");
    if (!contextParsed.ok) {
      setOutput(buildClientError(SEARCH_ENDPOINT, contextParsed.error ?? "invalid_context"));
      setSmokeResults(null);
      return;
    }
    setIsLoading(true);
    setSmokeResults(null);
    const response = await runRequest(SEARCH_ENDPOINT, {
      query,
      context: contextParsed.value,
    });
    setOutput(response);
    setIsLoading(false);
  };

  const handleResolve = async () => {
    const resolveParsed = safeParseJson(resolveJson, "Resolve JSON");
    if (!resolveParsed.ok) {
      setOutput(buildClientError(RESOLVE_ENDPOINT, resolveParsed.error ?? "invalid_resolve"));
      setSmokeResults(null);
      return;
    }
    setIsLoading(true);
    setSmokeResults(null);
    const response = await runRequest(RESOLVE_ENDPOINT, resolveParsed.value);
    setOutput(response);
    setIsLoading(false);
  };

  const handleSmoke = async () => {
    const contextParsed = safeParseJson(contextJson, "Context JSON");
    const resolveParsed = safeParseJson(resolveJson, "Resolve JSON");
    if (!contextParsed.ok) {
      setOutput(buildClientError(SEARCH_ENDPOINT, contextParsed.error ?? "invalid_context"));
      return;
    }
    if (!resolveParsed.ok) {
      setOutput(buildClientError(RESOLVE_ENDPOINT, resolveParsed.error ?? "invalid_resolve"));
      return;
    }
    setIsSmokeRunning(true);
    const results: ConsoleResponse[] = [];
    const searchResponse = await runRequest(SEARCH_ENDPOINT, {
      query,
      context: contextParsed.value,
    });
    results.push(searchResponse);
    const resolveResponse = await runRequest(RESOLVE_ENDPOINT, resolveParsed.value);
    results.push(resolveResponse);
    setSmokeResults(results);
    setOutput(resolveResponse);
    setIsSmokeRunning(false);
  };

  const handleCopy = async () => {
    if (!prettyJson) return;
    try {
      await navigator.clipboard.writeText(prettyJson);
    } catch {
      // Ignore clipboard errors to avoid false success claims.
    }
  };

  const handleClear = () => {
    setOutput(null);
    setSmokeResults(null);
  };

  const payload = output?.payload ?? null;
  const okValue = typeof payload?.ok === "boolean" ? payload.ok : null;
  const okVariant = okValue === true ? "default" : okValue === false ? "destructive" : "outline";
  const statusValue = extractField(payload, "status") ?? output?.status ?? 0;
  const noopValue = extractField(payload, "noop");
  const reasonCodeValue = extractField(payload, "reason_code");
  const requestIdValue = extractField(payload, "request_id") ?? extractField(payload, "trace_id");
  const calibration = extractCalibration(payload);
  const calibrationLabel =
    typeof calibration?.calibration_label === "string" ? calibration.calibration_label : null;
  const calibrationConfidence =
    typeof calibration?.confidence === "number" ? Math.round(calibration.confidence * 100) : null;
  const calibrationVariant =
    calibrationLabel === "high"
      ? "default"
      : calibrationLabel === "medium"
        ? "secondary"
        : calibrationLabel === "low" || calibrationLabel === "blocked"
          ? "destructive"
          : "outline";
  const missingEvidence = Array.isArray(calibration?.missing_evidence) ? calibration.missing_evidence : [];
  const requiredEvidence = Array.isArray(calibration?.required_evidence) ? calibration.required_evidence : [];
  const blockReason =
    typeof calibration?.block_reason === "string" && calibration.block_reason
      ? calibration.block_reason
      : null;
  const showCalibrationBlock =
    calibration?.block === true ||
    calibrationLabel === "blocked" ||
    ["calibration_blocked", "low_confidence", "confidence_gate"].includes(String(reasonCodeValue ?? ""));

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Decision Console</CardTitle>
          <CardDescription>
            POSTs to decision endpoints and renders the raw JSON response.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="decision-console-query">
                Query
              </label>
              <Textarea
                id="decision-console-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={3}
                placeholder="Enter query"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="decision-console-context">
                Context JSON
              </label>
              <Textarea
                id="decision-console-context"
                value={contextJson}
                onChange={(e) => setContextJson(e.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="decision-console-resolve">
                Resolve JSON
              </label>
              <Textarea
                id="decision-console-resolve"
                value={resolveJson}
                onChange={(e) => setResolveJson(e.target.value)}
                rows={6}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSearch} disabled={isLoading || isSmokeRunning}>
                <Play className="h-4 w-4 mr-2" />
                POST /api/search-decision
              </Button>
              <Button variant="outline" onClick={handleResolve} disabled={isLoading || isSmokeRunning}>
                <Play className="h-4 w-4 mr-2" />
                POST /api/resolve-decision
              </Button>
              <Button variant="secondary" onClick={handleSmoke} disabled={isLoading || isSmokeRunning}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Smoke (both endpoints)
              </Button>
              <Button variant="ghost" onClick={handleClear} disabled={isLoading || isSmokeRunning}>
                Clear
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">Output</div>
                <div className="text-xs text-muted-foreground">
                  HTTP status: {output?.status ?? 0}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopy} disabled={!prettyJson}>
                <Copy className="h-4 w-4 mr-2" />
                Copy JSON
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={okVariant}>
                ok: {okValue === null ? "unknown" : okValue ? "true" : "false"}
              </Badge>
              <Badge variant="outline">status: {String(statusValue)}</Badge>
              <Badge variant="outline">noop: {String(noopValue ?? "n/a")}</Badge>
              <Badge variant="outline">reason_code: {String(reasonCodeValue ?? "n/a")}</Badge>
              <Badge variant="outline">request_id: {String(requestIdValue ?? "n/a")}</Badge>
              <Badge variant={calibrationVariant}>calibration: {calibrationLabel ?? "n/a"}</Badge>
              <Badge variant="outline">
                confidence: {calibrationConfidence === null ? "n/a" : `${calibrationConfidence}%`}
              </Badge>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <div>Last request: {output?.endpoint ?? "n/a"}</div>
              <div>Timestamp: {output?.timestamp ?? "n/a"}</div>
              <div>Duration: {output?.durationMs ?? 0} ms</div>
            </div>

            {calibration && (
              <div className="rounded-md border p-3 text-xs space-y-2">
                <div className="font-medium">Calibration Guidance</div>
                {showCalibrationBlock && (
                  <>
                    <div>block_reason: {blockReason ?? "n/a"}</div>
                    <div>
                      missing_evidence: {missingEvidence.length > 0 ? missingEvidence.join(", ") : "none"}
                    </div>
                  </>
                )}
                <div>
                  required_evidence: {requiredEvidence.length > 0 ? requiredEvidence.join(", ") : "n/a"}
                </div>
                <div>
                  What would raise confidence?{" "}
                  {missingEvidence.length > 0 ? missingEvidence.join(", ") : "No additional evidence required."}
                </div>
              </div>
            )}

            {smokeResults && (
              <div className="rounded-md border p-3 text-xs space-y-2">
                <div className="font-medium">Smoke Results</div>
                {smokeResults.map((result) => {
                  const resultOk = typeof result.payload.ok === "boolean" ? result.payload.ok : null;
                  const resultVariant =
                    resultOk === true ? "default" : resultOk === false ? "destructive" : "outline";
                  const requestId =
                    extractField(result.payload, "request_id") ?? extractField(result.payload, "trace_id");
                  return (
                    <div key={result.endpoint} className="flex flex-wrap gap-2 items-center">
                      <Badge variant="outline">{result.endpoint.replace(API_BASE, "")}</Badge>
                      <Badge variant={resultVariant}>
                        ok: {resultOk === null ? "unknown" : resultOk ? "true" : "false"}
                      </Badge>
                      <Badge variant="outline">status: {result.status}</Badge>
                      <Badge variant="outline">request_id: {String(requestId ?? "n/a")}</Badge>
                    </div>
                  );
                })}
              </div>
            )}

            <pre className="min-h-[280px] whitespace-pre-wrap rounded-md border bg-background p-3 text-xs overflow-auto">
              {prettyJson || "{\n  \"ok\": false,\n  \"error\": {\n    \"code\": \"no_response\",\n    \"message\": \"No response yet\"\n  }\n}"}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
