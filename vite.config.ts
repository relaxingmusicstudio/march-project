import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildDiagReport, buildEnvReport } from "./src/server/diagSpine";
import { API_ROUTES } from "./src/kernel/routes";

const diagMiddleware = () => ({
  name: "diag-spine-dev",
  configureServer(server: {
    middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void };
  }) {
    server.middlewares.use("/api/diag", async (req, res) => {
      const env = process.env ?? {};
      const envReport = buildEnvReport(env);
      const timestamp = new Date().toISOString();
      const correlationId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `diag_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");

      if (req.method === "OPTIONS") {
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            ok: true,
            timestamp,
            correlation_id: correlationId,
            env: { present: envReport.present, sanity: envReport.sanity },
            checks: [],
            errors: [],
            note: "preflight",
          })
        );
        return;
      }

      if (req.method !== "GET") {
        res.statusCode = 405;
        res.end(
          JSON.stringify({
            ok: false,
            timestamp,
            correlation_id: correlationId,
            env: { present: envReport.present, sanity: envReport.sanity },
            checks: [],
            errors: [
              {
                name: "method",
                classification: "ROUTE",
                detail: "method_not_allowed",
              },
            ],
          })
        );
        return;
      }

      try {
        const report = await buildDiagReport({
          env,
          headers: req.headers,
          apiRoutes: API_ROUTES,
          correlationId,
          timestamp,
        });
        res.statusCode = 200;
        res.end(JSON.stringify(report));
      } catch (error) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            ok: false,
            timestamp,
            correlation_id: correlationId,
            env: { present: envReport.present, sanity: envReport.sanity },
            checks: [],
            errors: [
              {
                name: "diag",
                classification: "CODE",
                detail: error instanceof Error ? error.message : "diag_failed",
              },
            ],
          })
        );
      }
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger(), mode === "development" && diagMiddleware()].filter(
    Boolean
  ),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    cssMinify: false,
    sourcemap: true,
  },
}));

