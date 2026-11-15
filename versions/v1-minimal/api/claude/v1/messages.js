// Vercel serverless proxy for the in-app SI assistant. The Anthropic key lives only in the Vercel environment
// variable ANTHROPIC_API_KEY; the browser never sees it. Guard rails: same-site origins only, one model,
// capped max_tokens, body size limit and a best-effort per-IP rate limit.
const ALLOWED_MODELS = new Set(["claude-opus-5-5"]);
const MAX_TOKENS = 4000;
const MAX_BODY = 200000;
const PER_MINUTE = 15;
const hits = new Map();
// Production domains (the old name keeps working for links already shared). Not "orbitrack.vercel.app": not ours.
const SITE_HOSTS = new Set(["orbitrack-app.vercel.app", "outofspec-trend-detective.vercel.app"]);

function originAllowed(origin, host) {
  if (!origin) return true; // same-origin requests from some browsers omit Origin
  try {
    const u = new URL(origin);
    return u.host === host || u.hostname === "localhost" || u.hostname === "127.0.0.1" || SITE_HOSTS.has(u.hostname) || /^(orbitrack|outofspec-trend-detective)-[a-z0-9]+-[a-z0-9-]+\.vercel\.app$/.test(u.hostname);
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  const host = req.headers.host || "";
  const ok = originAllowed(origin, host);
  res.setHeader("Vary", "Origin");
  if (ok && origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ type: "error", error: { type: "invalid_request_error", message: "POST only" } });
  if (!ok) return res.status(403).json({ type: "error", error: { type: "permission_error", message: "Origin not allowed" } });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ type: "error", error: { type: "api_error", message: "Assistant not configured" } });

  const ip = String(req.headers["x-forwarded-for"] || "anon").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= PER_MINUTE) return res.status(429).json({ type: "error", error: { type: "rate_limit_error", message: "Too many requests - wait a minute" } });
  recent.push(now);
  hits.set(ip, recent);

  let body = req.body;
  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch {
    return res.status(400).json({ type: "error", error: { type: "invalid_request_error", message: "Invalid JSON" } });
  }
  if (!body || !ALLOWED_MODELS.has(body.model)) return res.status(400).json({ type: "error", error: { type: "invalid_request_error", message: "Model not allowed" } });
  if (JSON.stringify(body).length > MAX_BODY) return res.status(413).json({ type: "error", error: { type: "invalid_request_error", message: "Request too large" } });
  body.max_tokens = Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS);
  body.stream = false;

  const headers = { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": req.headers["anthropic-version"] || "2023-06-01" };
  if (req.headers["anthropic-beta"]) headers["anthropic-beta"] = req.headers["anthropic-beta"];
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body: JSON.stringify(body) });
    const text = await r.text();
    res.status(r.status);
    res.setHeader("content-type", "application/json");
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ type: "error", error: { type: "api_error", message: "Upstream error" } });
  }
};
