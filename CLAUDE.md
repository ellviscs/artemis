# ARTEMIS project rules

- Product: ARTEMIS, NASA Space Apps 2026. Harmonized MODIS + VIIRS burning-activity calendar and fire intelligence platform, focused on Indonesia. Full spec: `../GEMINI Handover.md`. Sprint plan: `../ARTEMIS Sprint Plan.md`.
- Never invent historical fire data. History comes only from processed NASA FIRMS archive files (`public/data/`). Anything simulated (escrow, payments, SMS bot, P2P board) must show a visible DEMO / SIMULATED tag in the UI.
- Never display the words "arson", "criminal", "pembakar" or similar on the public UI. Use "Anthropogenic Thermal Signature Probability".
- Suomi-NPP VIIRS delivery ended 2 Nov 2026. Live VIIRS = NOAA-20 + NOAA-21; S-NPP is archive-only (2012–2026).
- Keep the existing dark tactical aesthetic (near-black/zinc backgrounds, accent orange, mono uppercase labels). Extend working components; don't rewrite them.
- Data color ramps must be colorblind-safe (Viridis, Cividis, YlOrRd).
- API keys come only from env. FIRMS and OpenWeatherMap keys are server-side (`/api/*` serverless functions, no `VITE_` prefix). Never hard-code, log, or commit keys.
- Run `npm run typecheck` and `npm run lint` before declaring a task done.
