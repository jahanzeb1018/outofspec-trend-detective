# Use of Super Intelligence (SI)

⚠️ The team must complete this file with an accurate account of how SI was used before submitting.

* **In the product:** an optional assistant ("Ask the detective", "Explain this", "Describe your track", and "Brief me" on the heat watch, which writes a 3-sentence summary from the numbers on screen) calls Anthropic's Claude (`claude-opus-5-5`) through the official SDK. It can only pick options from a closed catalog (NASA variables, places, routes, track presets) and read numbers computed by the engine through tools. Its outputs are labelled "SI-assisted". Without a key or proxy, a rule-based mode is used and labelled "rule-based". The key is held server-side (Vercel environment variable) behind a same-origin proxy (`web/api/claude`); it is never sent to the browser.
* **During development:** [describe accurately, e.g. SI tools were used to help write code, documentation and to support literature search/fact-checking].
* **Images and video:** [state whether any SI-generated images/video were used; if so they carry a visible watermark].
* **Numbers:** every number shown in the app is computed by the open pipeline from NASA data and published model parameters, never by the assistant.
