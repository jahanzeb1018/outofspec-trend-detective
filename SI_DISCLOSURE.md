# Use of Super Intelligence (SI)

NASA Space Apps Challenge 2026 asks every team to say where and how SI tools were used. This is our account.

* **During development:** Anthropic's Claude helped with code (writing and reviewing the Python pipeline and the web app), data processing and wording (documentation, interface texts and presentation texts). The idea, the design, the scientific choices and all checks are ours: we reviewed the code, ran the tests (pytest and Vitest parity tests between the Python and browser statistics) and checked the numbers against the data and the cited sources.
* **Numbers:** every number shown in the app is computed by the open pipeline from NASA data and published model parameters, never by an SI tool.
* **In the product:** an optional assistant ("Ask the detective", "Explain it", "Describe your track") calls Anthropic's Claude (`claude-opus-5-5`) through the official SDK. It can only pick options from a closed catalog (NASA variables, places, routes, track presets) and read numbers computed by the engine through tools. Its outputs are labelled "SI-assisted". Without a key or proxy, a rule-based mode is used and labelled "rule-based". The key is held server-side (Vercel environment variable) behind a same-origin proxy (`web/api/claude`); it is never sent to the browser.
* **Images and video:** the cover visual of our slide deck and the rail image on its last slide are SI-generated and carry a visible "AI-generated visual" label. The app itself uses no SI-generated images: its maps, charts, drawn tracks and logo are drawn in code (SVG and MapLibre) from the data. The demo video is a screen recording of the live app.
* **NASA branding:** no SI-generated content uses or modifies NASA logos, flags or mission identifiers.
