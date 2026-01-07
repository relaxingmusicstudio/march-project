import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { IncomingMessage, ServerResponse } from "node:http";
import { routeApiRequest } from "./api_handlers/router";

const apiMiddleware = () => ({
  name: "api-router-dev",
  configureServer(server: {
    middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void };
  }) {
    server.middlewares.use((req, res, next) => {
      if (!req.url || !req.url.startsWith("/api/")) {
        next();
        return;
      }
      if (req.url.startsWith("/api/health")) {
        const now = new Date().toISOString();
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify({ status: "ok", ok: true, source: "vite-dev", ts: now }));
        return;
      }
      void routeApiRequest(req, res);
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger(), mode === "development" && apiMiddleware()].filter(
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

