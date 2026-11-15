// Shared 7-day forecast for every NASA cell of the network, fetched from Open-Meteo (CC BY 4.0) once and cached
// on Vercel's CDN for an hour, so all visitors share one upstream call instead of each browser making ~160.
// The browser falls back to calling Open-Meteo directly if this endpoint is unavailable.
const CHUNK = 80;
let mem = null; // { t, body }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chunk(cells) {
  const lat = cells.map(([, c]) => c.lat.toFixed(2)).join(",");
  const lon = cells.map(([, c]) => c.lon.toFixed(3)).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,shortwave_radiation_sum,wind_speed_10m_mean&timezone=Europe%2FMadrid&forecast_days=7`;
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url);
    if (r.ok) {
      const j = await r.json();
      return (Array.isArray(j) ? j : [j]).map((x) => x.daily);
    }
    if (attempt >= 2 || (r.status !== 429 && r.status < 500)) throw new Error(`open-meteo ${r.status}`);
    await sleep(1500 * (attempt + 1));
  }
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  try {
    if (!mem || Date.now() - mem.t > 30 * 60000) {
      const w = require("../data/watch.json");
      const entries = Object.entries(w.cells);
      const daily = [];
      for (let i = 0; i < entries.length; i += CHUNK) daily.push(...(await chunk(entries.slice(i, i + CHUNK))));
      mem = { t: Date.now(), body: JSON.stringify({ issued: new Date().toISOString(), ids: entries.map(([id]) => id), daily }) };
    }
    res.setHeader("content-type", "application/json");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=10800");
    return res.status(200).send(mem.body);
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "forecast unavailable" });
  }
};
