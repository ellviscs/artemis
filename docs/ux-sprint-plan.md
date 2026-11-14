# ARTEMIS UX sprint plan (U1–U5)

This plan splits the UX feedback from 14 Nov 2026 into five sprints. Each sprint is one prompt for one session. Run them in order. Each one starts from a clean commit of the one before.

**Before U1:** commit the current Sprint 6 work and the KARHUTLA redesign as they are, so every sprint has a clean diff to review.

## Rules for every sprint

These are the standing rules from `CLAUDE.md`.

- **Real data only.**
  - Fire history comes only from `public/data/`.
  - Anything simulated shows a DEMO or SIMULATED tag.
- **Wording.**
  - Never show "arson", "criminal" or "pembakar".
  - The signature is a score (0–100 plus a national percentile), never a probability.
- **Colour.**
  - Data ramps stay colorblind-safe (Viridis, Cividis, YlOrRd).
  - KARHUTLA orange is for brand, buttons and active states. It is never a data ramp.
- **Readable text** is at least 45% white on dark backgrounds and passes WCAG AA on light ones.
- **Motion** respects `prefers-reduced-motion`. Nothing breaks if a script fails to load.
- **Process.**
  - Ask before installing any npm package.
  - Run `npm run typecheck`, `npm run lint` and `npm run build`.
  - Verify in the browser at 1440 px and 375 px.
  - Commit only when the user says so.

---

## U1 · Landing: typography, colour flow and the news band

**Goal:** fix the type and colour basics before adding motion, so U2 animates the final look.

**Prompt:**

> Read `CLAUDE.md`, `DESIGN.md` and `docs/ux-sprint-plan.md` (sprint U1). Use the impeccable and design-taste-frontend skills.
>
> 1. **Display font.**
>    - Drop Instrument Serif everywhere, and remove every italic headline (for example the gradient word in the hero `<h1>` in `ArtemisLanding.tsx`).
>    - Titles get a wide, extended display face in the spirit of Horizon.
>    - **Show me a preview first:** a single page rendering the hero headline and one section title in 3–4 free web fonts, such as Michroma, Syncopate, Unbounded and Krona One. Horizon itself only if its licence allows web use; check and tell me.
>    - Include one treatment per font: a subtle neon or ember glow, or an animated gradient sweep.
>    - Wait for my pick, then apply it to `font-display` in `tailwind.config.js` and update `DESIGN.md`.
>    - Body stays Inter; labels stay JetBrains Mono.
> 2. **Smooth colour flow.**
>    - The landing's sections must blend into each other, with no hard edges between the paper, dark and thermal areas.
>    - Build the transitions from long, layered gradients, using more aggressive KARHUTLA gradients (#E69430 → #D9831C → #C67438 → #9E4324 → #612C25), plus grain.
>    - Define them once as CSS tokens or utilities in `src/index.css`.
> 3. **Wildfire news section.**
>    - Restyle it to match the orange of the dashboard's Burning Calendar: the same orange accents, card borders and hover states as the graph page, instead of the current plain dark band.
>    - Keep the `/api/news` proxy as it is.
> 4. Verify both widths in the browser, then stop. Motion is U2.

**Done when:** the font is picked and applied, there is no serif or italic left, the sections blend with no visible seams, and the news band reads as the same family as the dashboard.

---

## U2 · Landing: unboxed Earth and scroll motion

**Goal:** make the landing feel like one continuous scene.

**Prompt:**

> Read `docs/ux-sprint-plan.md` (sprint U2). Use the gsap-skills plugin (gsap-react, gsap-scrolltrigger, gsap-timeline, gsap-performance), plus impeccable and design-taste-frontend.
>
> 1. **Install GSAP.** Ask me before running `npm install gsap @gsap/react`. All GSAP plugins are free now. Lazy-load the ScrollTrigger code with the landing so the dashboard bundle does not grow.
> 2. **Unbox the Earth.**
>    - Remove the dark window around the R3F globe in `src/components/landing/EarthHero.tsx`.
>    - The globe sits directly in the hero, with its orange atmosphere bleeding into the page gradient (transparent canvas, `alpha: true`).
>    - It may be larger and partly cropped by the viewport edge.
>    - Re-tune spin and lean in `earthTuning.ts` and the `?tune=1` panel for the new framing. The old pending values (spin 0.245, lean 0.02) were for the boxed globe.
> 3. **Scroll choreography (ScrollTrigger, with `gsap.matchMedia` for reduced motion).**
>    - Headline reveal: split-line or character stagger for the new display font.
>    - The globe scales or rotates with scroll progress and hands off into the ticker.
>    - Section gradients shift hue as you scroll, from paper to ember to dark.
>    - Feature cards and the news band enter with staggered reveals.
>    - Replace the current IntersectionObserver chart triggers (`useInView`, `.chart-draw`, `.slide-marks`) with ScrollTrigger only where that is smoother. Keep CSS where it already works.
>    - No scroll-jacking; pinning only if it stays smooth at 60 fps on a mid-range laptop.
> 4. **Liquid glass.** html2canvas cannot see WebGL. Decide whether the glass cards still work over the new gradients, re-snapshotting after GSAP layout settles, or whether to switch them to CSS-only glass. Tell me which, and why.
> 5. Verify in the browser at both widths, including reduced motion, and check the bundle sizes.

**Done when:** there is no box around the Earth, scrolling top to bottom feels continuous, reduced motion shows the final states, and the main bundle has not grown.

---

## U3 · Command center: colour-rich detections (preview first)

**Goal:** detections show data colour again, not a single orange.

**Context:**
- The live harmonized layer in `FireMap.tsx` draws every point in one colour (`harmonized: '#d9831c'`).
- The archive hexes in `ArchiveMapLayers.tsx` already use the selected ramp (`rampColor`).
- The user remembers an earlier version where the Viridis, Cividis and YlOrRd gradients showed in the dots.

**Prompt:**

> Read `docs/ux-sprint-plan.md` (sprint U3). **Do not change code until I approve a preview.**
>
> 1. **Ask me first.**
>    - What should a dot's colour encode: FRP (MW), detection confidence, hours since detection, or brightness temperature?
>    - Should the colour follow the Viridis / Cividis / YlOrRd switch in the control bar?
>    - Should MODIS and VIIRS keep different shapes or outlines so the sensor stays visible without using colour?
> 2. **Find the earlier look.** Check `git log -p` for `FireMap.tsx` and the original `Artemis-master` baseline to see how dots were coloured before. Screenshot it if the old commit still runs.
> 3. **Preview.** Render 2–3 options side by side, as a static page or a `?preview=dots` flag on the dashboard, using today's real FIRMS points:
>    - (a) ramp colour by FRP with a legend;
>    - (b) ramp colour plus a soft glow for the hottest decile;
>    - (c) the previous version's styling.
>    I pick one.
> 4. **Implement.**
>    - Apply the chosen option with a matching legend in the map's legend panel.
>    - Use a log scale where the value is skewed.
>    - Keep the dark outline for contrast on the basemap.
> 5. Verify on `/dashboard` with each ramp.

**Done when:** I picked an option from the preview, the dots and legend follow the ramp switch, and the colours stay colorblind-safe.

---

## U4 · Impact Hub: entry, transition and real local campaigns

**Goal:** people notice the hub, get a better transition into it, and find campaigns that really work in the selected area.

**Prompt:**

> Read `docs/ux-sprint-plan.md` (sprint U4). Use gsap-skills and impeccable.
>
> 1. **Hub entry button.**
>    - "Open impact hub" in `HotspotInspector.tsx` needs much higher contrast and a clear call to action: a filled KARHUTLA gradient, a subtle ember pulse or glow when a hotspot is first selected, and a clear label and icon.
>    - It must pass WCAG AA.
> 2. **Transition into the hub.**
>    - Replace the plain open with a shared-element feel: the button expands into the hub panel (GSAP Flip or a timeline), with smoke or ember continuity with the existing `TransitionRoutes` veil in `App.tsx`.
>    - Keep Escape-to-close and focus trapping, and the reduced-motion fallback.
> 3. **Local campaigns in the Satellite Escrow tab (`EscrowTab.tsx`, `src/data/donationApi.ts`).**
>    - **Research step first; show me the list before coding.** For each province the archive covers (start with Central Kalimantan, Riau, South Sumatra, West Kalimantan and Jambi), find organizations and communities that actually work on fire prevention, response or restoration there.
>      - Examples of the kind to look for: Masyarakat Peduli Api groups, BOS Foundation, Borneo Nature Foundation, Save Our Borneo, local Manggala Agni partners, Kitabisa or Rumah Zakat karhutla campaigns.
>    - Store each one as a record in a data file with: name, type (NGO / community / campaign), province and coordinates of their work area, a description of their work, official website, official social accounts (only from the organization's own site), donation link, source URL, and last-checked date.
>    - **No invented organizations, handles or numbers.** Leave out anything that cannot be sourced.
>    - **Verified badge:** define one written rule and show it in a tooltip. For example: registered foundation and listed by a known platform (Every.org, Kitabisa verified), or the official site confirms the program in this province. Only records that meet it get the badge.
>    - Rank campaigns by distance from the selected spot and province match. Show "nearest work area: X km".
> 4. **Scrollable donations list.** The campaign list gets a fixed-height scroll area with a fade at the edges, instead of growing the page. Keep keyboard scrolling and focus visible.
> 5. Keep the SIMULATED tag on escrow pledges. The campaign links are real; the pledge pool is not.
> 6. Verify `/impact?lat=-3.2138&lng=112.6795` and one Riau location at both widths.

**Done when:** the button is obvious, the transition is smooth, every campaign has a source, badges follow the written rule, and the list scrolls inside its card.

---

## U5 · QA, commit and deploy

**Prompt:**

> Read `docs/ux-sprint-plan.md` (sprint U5).
>
> 1. Do a full pass of every route at 1440 px and 375 px, with reduced motion on and off.
> 2. Run a contrast check and a check for leaked keys (no server keys in `dist`).
> 3. Fix `og:image` and `twitter:image` in `index.html`; they still point to `/src/logo/Artemis.jpg`.
> 4. Look at the main bundle (about 765 kB) and split out what is cheap to split.
> 5. Ask me to approve the commit, then the deploy route:
>    - (A) gzip `hex/` and `forensics/` to fit Vercel's 100 MB CLI limit, or
>    - (B) GitHub plus Vercel Git integration.

## Decisions waiting on you

| Sprint | Decision |
| --- | --- |
| U1 | Display font, picked from the preview |
| U2 | Installing GSAP; keeping the liquid glass vs CSS glass |
| U3 | What dot colour encodes; picked from the preview |
| U4 | The researched campaign list and the badge rule |
| U5 | Commit; deploy route A or B |
