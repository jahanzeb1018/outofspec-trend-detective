// Optional Cloudflare Worker that keeps the Anthropic API key server-side for the public demo.
// Deploy:  npx wrangler deploy proxy/worker.js --name trend-detective-ai
//          npx wrangler secret put ANTHROPIC_API_KEY
//          set the variable ALLOWED_ORIGIN to your GitHub Pages origin (e.g. https://<user>.github.io)
// Then build the site with VITE_AI_PROXY_URL=https://trend-detective-ai.<account>.workers.dev
const LIMIT_PER_MINUTE = 20;
const hits = new Map();

function cors(origin, allowed) {
  return {
    "Access-Control-Allow-Origin": origin === allowed ? origin : allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, anthropic-version, anthropic-beta, anthropic-dangerous-direct-browser-access, x-api-key, x-stainless-arch, x-stainless-lang, x-stainless-os, x-stainless-package-version, x-stainless-retry-count, x-stainless-runtime, x-stainless-runtime-version, x-stainless-timeout",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "";
    const headers = cors(origin, allowed);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    if (request.method !== "POST" || !url.pathname.startsWith("/v1/messages")) return new Response("Not found", { status: 404, headers });
    if (allowed && origin !== allowed) return new Response("Origin not allowed", { status: 403, headers });
    // best-effort rate limit per client IP
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
    if (recent.length >= LIMIT_PER_MINUTE) return new Response("Too many requests", { status: 429, headers });
    recent.push(now);
    hits.set(ip, recent);
    const upstream = new Headers();
    for (const [k, v] of request.headers) {
      const key = k.toLowerCase();
      if (key.startsWith("anthropic-") || key === "content-type") upstream.set(k, v);
    }
    upstream.set("x-api-key", env.ANTHROPIC_API_KEY);
    upstream.delete("anthropic-dangerous-direct-browser-access");
    const res = await fetch(`https://api.anthropic.com${url.pathname}${url.search}`, { method: "POST", headers: upstream, body: request.body });
    const out = new Headers(res.headers);
    for (const [k, v] of Object.entries(headers)) out.set(k, v);
    return new Response(res.body, { status: res.status, headers: out });
  },
};
