# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: emergency managers** (BPBD/BNPB-style disaster and fire response coordinators, NASA's stated target audience) monitoring an Indonesian region. Their job is to see quickly where fires are burning now, whether this month or season is abnormal against the area's history, and what to act on. When audience needs conflict, design for this user first.

Secondary audiences, in the order they appear in the spec:
- Scientists and land managers studying 20-year burn patterns, seasonality and anomalies.
- Field patrols (*Masyarakat Peduli Api*, MPA) and local citizens with low bandwidth, often reached by SMS/WhatsApp rather than the web app.
- Donors and CSR funders choosing where help has the most impact.
- B2B compliance buyers (EUDR/RSPO due-diligence teams, parametric wildfire insurers) auditing a plot's burn history.
- NASA Space Apps judges evaluating the submission against the challenge brief.

## Product Purpose

ARTEMIS is a harmonized MODIS + VIIRS burning-activity calendar and fire intelligence platform, built for the NASA Space Apps Challenge 2026 ("harmonized burning activity calendar" challenge). It combines MODIS's 2000→ record with VIIRS's finer 2012→ record into one consistent hotspot series, so the sensor of origin stops mattering and patterns, trends and anomalies become the focus.

Success means a user can select an area and date range and immediately see which months and years burned most, how the current month compares with the historical median, and download the hotspots and analytics as CSV. Beyond the NASA brief, it turns a detected hotspot into a concrete next action (response, verification, early warning, funding, compliance).

## Positioning

Existing Indonesian disaster platforms rely on 24–48-hour live FIRMS feeds for reactive response and attach static donation links that often don't exist for remote hotspots. ARTEMIS adds a calibrated 20+ year satellite memory (MODIS-equivalent harmonized counts, so the 2012 VIIRS jump doesn't skew baselines) and uses it for anomaly detection, a transparent anthropogenic-signature score, and an impact router that gives every coordinate an action.

## Operating Context

- Geographic focus: Indonesia, with five priority fire provinces: Riau, Jambi, South Sumatra, West Kalimantan, Central Kalimantan. Global and other-country regions remain available.
- Data sources: NASA FIRMS (MODIS standard + NRT; VIIRS S-NPP standard archive 2012–2026; VIIRS NOAA-20/NOAA-21 NRT and standard), OpenWeatherMap, OpenStreetMap (Nominatim, Overpass), NewsData.io, Every.org, Kitabisa campaign links, CARTO basemaps.
- Suomi-NPP VIIRS delivery ended 2 November 2026; live VIIRS comes from NOAA-20 + NOAA-21.
- Local institutions and terms the product references: BPBD/BNPB, MPA, Karhutla, Gakkum KLHK, SP4N-LAPOR!, QRIS.
- Built in 1–2 days by one developer working sequentially; sprint plan in `../ARTEMIS Sprint Plan.md`, full spec in `../GEMINI Handover.md`.

## Capabilities and Constraints

- Routes: `/` landing, `/dashboard` command center, `/audit` EUDR & InsurTech portal; the 4-branch Impact Hub opens as a modal.
- Core (NASA rubric): region / lat-long / drawn-polygon area selection, 2000–2026 date range, Year × Month burning calendar with raw vs harmonized toggle, current-month anomaly vs 20-year median, static industrial/volcanic heat mask, colorblind-safe ramps, CSV export.
- Extended: hotspot inspector with Anthropogenic Thermal Signature Probability (rule-based score from four features, not a trained model), cloud-obscured persistence warning, 4-branch Impact Hub (satellite escrow + donations, citizen ground-truth, downwind haze shield, civic dossier + P2P logistics), EUDR/InsurTech plot audit.
- Stack: React 18 + TypeScript + Vite + Tailwind + Leaflet; Vercel serverless functions in `api/` hold the FIRMS and OpenWeatherMap keys; Python pipeline produces static historical data in `public/data/`.
- History must come from the real FIRMS archive. Escrow payments, QRIS pledges, the SMS/WhatsApp bot, broadcasts and the P2P board are simulations and must be labeled as such.
- Interface language: English, keeping Indonesian institutional and local terms (MPA, Karhutla, Gakkum KLHK, BPBD) where they are the real names.

## Brand Commitments

- Name: ARTEMIS. The current logo (`src/logo/Artemis.jpg`) is not a binding commitment.
- Dark tactical aesthetic is binding: near-black panels, orange accent, mono uppercase labels, consistent with the live prototype at `artemis-1-1.vercel.app`.
- Voice is scientific and non-accusatory: report observations and probabilities, never verdicts. Never use "arson", "criminal", "pembakar" or similar on the public UI; use "Anthropogenic Thermal Signature Probability". Always state what is simulated and what satellite detections can't prove.
- Credit the ITS Surabaya team (Institut Teknologi Sepuluh Nopember) and the NASA Space Apps Challenge 2026.

## Evidence on Hand

- Live NASA FIRMS NRT detections (MODIS, VIIRS NOAA-20, VIIRS NOAA-21), verified working on 2026-11-14.
- FIRMS yearly country archive CSVs for Indonesia (MODIS, VIIRS S-NPP, VIIRS NOAA-20), confirmed reachable.
- Verified public wildfire campaign links: Kitabisa (Riau, national) and Rumah Zakat (Central Kalimantan), listed in `README.md`.
- No real users, testimonials, partner agreements, customers, pilots, institutional endorsements or ground-truth labels exist. Don't fabricate them. B2B demo plots and company names must be fictional and labeled as demos.

## Product Principles

1. **Real data or labeled simulation, never in between.** Every number traces to FIRMS or a stated method; every mock shows a visible tag.
2. **History gives the context.** A detection means little until it's compared with that place's 20-year harmonized baseline; lead with the comparison, not the raw count.
3. **Observations, not accusations.** Probabilities, uncertainty ellipses and plain-language caveats come with every forensic signal.
4. **Every coordinate has a next action.** No dead-end buttons; when a local option is missing, route to one that exists.
5. **The emergency manager first.** Fast scan of "where, how abnormal, what now" beats depth when space or time is short.

## Accessibility & Inclusion

- Data color ramps must be colorblind-safe (Viridis, Cividis, YlOrRd) and labeled as such; never encode meaning by color alone.
- Field audiences may be on low bandwidth; the offline SMS/WhatsApp path exists for them, and the web app should stay usable on phone widths.
