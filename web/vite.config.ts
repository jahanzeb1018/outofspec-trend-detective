import { loadEnv, type ProxyOptions } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Static, relative-path build. In dev/preview, /api/claude is proxied to the Anthropic API with the key from
// web/.env.local (never bundled); in production the Vercel function in /api does the same.
// A new version tag on every build: data URLs carry it so browsers never mix a new page with cached old data.
const DATA_V = Date.now().toString(36);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy: Record<string, ProxyOptions> = {
    "/api/claude": {
      target: "https://api.anthropic.com",
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api\/claude/, ""),
      configure: (proxyServer) => {
        proxyServer.on("proxyReq", (req) => {
          if (env.ANTHROPIC_API_KEY) req.setHeader("x-api-key", env.ANTHROPIC_API_KEY);
          req.removeHeader("origin");
        });
      },
    },
  };
  return {
    base: "./",
    define: { "import.meta.env.VITE_DATA_V": JSON.stringify(DATA_V) },
    plugins: [react()],
    build: { chunkSizeWarningLimit: 1500 },
    worker: { format: "es" as const },
    server: { proxy },
    preview: { proxy },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      testTimeout: 60000,
    },
  };
});
