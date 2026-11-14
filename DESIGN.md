---
name: ARTEMIS
description: Night-ops console for harmonized MODIS + VIIRS fire intelligence
colors:
  signal-orange: "#f9880f"
  signal-orange-bright: "#ffab2e"
  ember: "#ffc75d"
  ember-pale: "#ffe09a"
  night-black: "#050505"
  console-black: "#07090b"
  header-black: "#080b0e"
  panel-black: "#0b0b0b"
  raised-black: "#111111"
  ash-text: "#e4e7ec"
  hairline: "rgba(255, 255, 255, 0.12)"
  status-clear: "#6ee7b7"
  status-advisory: "#7dd3fc"
  status-watch: "#fcd34d"
  status-warning: "#fdba74"
  status-extreme: "#fca5a5"
  sensor-modis: "#3b82f6"
  sensor-viirs: "#06b6d4"
typography:
  display:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "3.75rem"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.12em"
  data:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "\"tnum\" 1"
rounded:
  sm: "2px"
  md: "4px"
  lg: "6px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-orange}"
    textColor: "{colors.night-black}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.signal-orange-bright}"
    textColor: "{colors.night-black}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ash-text}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "12px 20px"
  panel:
    backgroundColor: "{colors.panel-black}"
    textColor: "{colors.ash-text}"
    rounded: "{rounded.md}"
    padding: "16px"
  stat-tile:
    backgroundColor: "{colors.raised-black}"
    textColor: "{colors.ash-text}"
    typography: "{typography.data}"
    rounded: "{rounded.sm}"
    padding: "12px"
  badge:
    backgroundColor: "rgba(255, 255, 255, 0.04)"
    textColor: "{colors.ash-text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  map-overlay:
    backgroundColor: "rgba(11, 13, 11, 0.9)"
    textColor: "{colors.ash-text}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
---

# Design System: ARTEMIS

## Overview

**Creative North Star: "The Night Ops Console"**

ARTEMIS is a mission-control desk at 3 a.m. The room is dark and quiet so the eye goes straight to the one thing that matters: a fire signal. Everything structural (panels, rules, labels, gridlines) sits in near-black and low-contrast ash; orange is reserved for signal and the single primary action. The console reads as an instrument, not a marketing page: mono uppercase labels name each readout, numbers sit in tabular mono, and prose is short and factual.

Density is operational. Emergency managers scan region, anomaly and next action in seconds, so panels are compact, borders are hairlines, and decoration is limited to a faint 40px blueprint grid on the page background and a soft orange glow behind live indicators. Data visualisations are the brightest, most colorful things on screen, which is why their ramps must be colorblind-safe and must never compete with the brand orange.

The aesthetic is binding (see PRODUCT.md): this dark tactical world extends the live prototype at `artemis-1-1.vercel.app`; it does not get a light theme or a softer consumer look.

**Key Characteristics:**
- Near-black layered surfaces (#050505 → #111111) separated by 12%-white hairlines.
- One brand voice: signal orange, used for primary actions, live indicators and accent text only.
- JetBrains Mono for every label, headline and number; Inter only for running prose.
- Tight, technical corners (2–6px); full rounding only for status dots.
- Status is color-coded and always paired with a text label and icon.

## Colors

A blackout palette with a single signal color; everything else is status, sensor identity or data.

### Primary
- **Signal Orange** (#f9880f): primary buttons, the focus ring, live/active dots, the "harmonized" layer, and selection highlights. It means "attention here" or "this is the action."
- **Signal Orange Bright** (#ffab2e): hover state of primary actions.
- **Ember** (#ffc75d) and **Ember Pale** (#ffe09a): accent text on dark (eyebrows, highlighted headline lines, active filter values). Use these, not Signal Orange, when orange text must stay readable at small sizes.

### Neutral
- **Night Black** (#050505): document background, map canvas, text on orange buttons.
- **Console Black** (#07090b): app page background on landing and dashboard.
- **Header Black** (#080b0e): sticky header and top bars (at 95% opacity with backdrop blur).
- **Panel Black** (#0b0b0b): standard panel / card surface.
- **Raised Black** (#111111): stat tiles and tooltips that sit on top of panels.
- **Ash Text** (#e4e7ec): base text color. Secondary text uses white at 60%, tertiary at 45–55%; never go below 45% for anything a user must read (40% fails AA at label sizes).
- **Hairline** (rgba(255,255,255,0.12)): panel borders and dividers; 8–10% for internal dividers.

### Status (early-warning scale)
- **Clear** (#6ee7b7), **Advisory** (#7dd3fc), **Watch** (#fcd34d), **Warning** (#fdba74), **Extreme** (#fca5a5): text and icon color for the five warning levels, each with a matching 30% border and 5% fill of the same hue.

### Sensor identity
- **MODIS Blue** (#3b82f6) and **VIIRS Cyan** (#06b6d4): raw sensor layers on the map and sensor-comparison readouts. Harmonized data takes Signal Orange.

### Named Rules
**The One Signal Rule.** Signal Orange covers no more than ~10% of any screen. If two things on the same screen are both orange, one of them is wrong.

**The Safe Ramp Rule.** Anything that encodes quantity (calendar heatmap, hexagon grid, anomaly scale) uses a colorblind-safe ramp (Viridis, Cividis or YlOrRd), labeled "Colorblind-safe" in the UI. The legacy `flame` scale in `tailwind.config.js` is not colorblind-safe and must not be used for data.

**The Never-Color-Alone Rule.** Every status color ships with a text label (CLEAR, WATCH, …) and, where space allows, an icon.

## Typography

**Display Font:** JetBrains Mono (with monospace)
**Body Font:** Inter (with system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono

**Character:** Mono does the talking: headlines, labels and numbers read like instrument readouts. Inter carries only explanatory prose, where readability beats character. Inter is kept for now and is open for replacement in a later typeset pass; don't spread it into headings or labels.

### Hierarchy
- **Display** (600, 2.25rem mobile → 3.75rem desktop, 1.08, −0.045em): landing hero headline only.
- **Headline** (600, 1.25rem → 1.875rem, 1.2, −0.035em): page titles such as the dashboard's "LIVE FIRE INTELLIGENCE // EARLY WARNING".
- **Title** (Inter 600, 1.125rem, 1.4): panel and card titles in sentence case, warning titles.
- **Body** (Inter 400, 0.875rem, 1.7): descriptions and caveats; max ~65ch (`max-w-xl`/`max-w-2xl`).
- **Label** (Mono 600, 0.625rem, 0.12em, UPPERCASE): eyebrows, metric labels, status levels, button text, legend text.
- **Data** (Mono 700, 1.5rem, tabular numerals): stat values, counts, FRP, Z-scores.

### Named Rules
**The Readout Rule.** Every number a user compares (counts, MW, %, σ, dates in tables) is mono with tabular numerals so columns align.

**The Short Caps Rule.** Uppercase is for labels of three words or fewer. Sentences are never set in caps.

## Layout

- **Container:** content max width 1600px on the dashboard, 1440px on the landing page; side gutters 12px (mobile) → 24px (sm+) on the dashboard, 20px → 32px on landing.
- **Dashboard grid:** a full-width map column with a 19rem right sidebar at `lg` (1024px); below `lg` everything stacks in one column. Secondary panels sit in two columns at `lg`.
- **Rhythm:** a 4px base. Panel padding is 16–20px, gaps between panels 12px, gaps inside panels 8–12px. Sections are separated by hairline rules, not big whitespace.
- **Map:** 430px tall on mobile, 540px from `sm`; overlays float inside the map at 12–20px from the edges.
- **Header:** sticky, 95% Header Black with backdrop blur, a hairline bottom border and a soft drop shadow.
- **Background:** the page carries a faint 40×40px grid of 1.2%-white lines; panels sit above it on solid black.

## Elevation & Depth

Depth is mostly tonal: surfaces step from Night Black to Panel Black to Raised Black, each edged with a hairline. Shadows are ambient and dark (they separate panels from the grid background rather than "lifting" them), and only live elements glow.

### Shadow Vocabulary
- **Panel ambient** (`box-shadow: 0 1px 0 rgba(255,255,255,0.025), 0 16px 32px rgba(0,0,0,0.18)`): the standard panel surface; the 1px top line gives a faint machined edge.
- **Overlay lift** (`box-shadow: 0 24px 80px rgba(0,0,0,0.35)`): floating hero cards and modals.
- **Signal glow** (`box-shadow: 0 0 10px–24px rgba(249,136,15,0.2–0.8)`): live status dots and the primary hero button only.

### Named Rules
**The Glow-Means-Live Rule.** A glow is a status signal, never decoration. If nothing is live, nothing glows.

## Shapes

Tight and technical. Corners are 2px on data cells, stat tiles and badges, 4px on panels and cards, 6px on buttons, inputs and map overlays. Full rounding is reserved for status dots, avatars and toggle knobs.

The current code still has softer 8–16px corners on some panels, the map frame and the landing hero card. Those are drift: bring them to this scale whenever a component is touched, not in a separate sweep.

Borders are always hairlines (1px, 8–16% white); a 4px left border in the status color marks the early-warning banner.

## Components

### Buttons
- **Shape:** gently squared (6px).
- **Primary:** Signal Orange fill, Night Black mono uppercase label at 0.1em tracking, 12px × 20px padding; at most one per view.
- **Hover / Focus:** fill shifts to Signal Orange Bright; keyboard focus shows a 2px Signal Orange outline at 3px offset plus a 4px 18%-orange halo (global rule in `index.css`).
- **Secondary:** transparent with a 16%-white hairline and 65%-white label; hover raises the border to 30% and the text to white.
- **Tertiary / link:** mono uppercase label in Ember with an arrow icon, no box.

### Chips / Badges
- **Style:** 2px corners, 4% white fill, 6% white border, 50% white text; tinted variants use the status hue at 10% fill, 20% border.
- **Use:** sensor names, data-source tags and the mandatory `DEMO` / `SIMULATED` tags.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** Panel Black, with Raised Black for nested tiles.
- **Shadow Strategy:** Panel ambient (see Elevation & Depth).
- **Border:** hairline (12% white); title row separated by a 15% steel-blue rule (`#9dadbe` at 15%).
- **Internal Padding:** 16px; title rows 12px × 16px with a mono uppercase 12px title and a 10px mono subtitle.

### Navigation
- **Style:** sticky header with the ARTEMIS wordmark in mono bold at 0.08em tracking and a mono eyebrow beneath; header actions are small mono uppercase buttons (secondary style), with the primary action in the tinted-orange variant (10% orange fill, 35% orange border, Ember Pale text).
- **Mobile:** secondary header items hide below `lg`; one compact action stays visible.

### Stat Tile (signature)
A Raised Black tile with a mono uppercase label at top and a large tabular mono value beneath; hover lifts the border from 12% to 24% white. This is the unit of the console: counts, FRP, confidence and anomaly all use it.

### Map Overlay Panel (signature)
Translucent near-black (90% #0b0d0b) with backdrop blur, a hairline border and a 10px mono uppercase heading. Used for layer toggles, legends and the weather card; it floats inside the map and never covers more than a third of it.

### Early-Warning Banner (signature)
A full-width band in the status color: 4px left border, 30% border, 5% fill, a status icon, a mono uppercase level label, an Inter title and a factual caveat line with a shield icon. Below it, four compact metric tiles.

## Do's and Don'ts

### Do:
- **Do** keep every surface in the near-black range (#050505–#111111) and separate surfaces with hairlines.
- **Do** reserve Signal Orange (#f9880f) for the single primary action, live indicators and the harmonized data layer.
- **Do** set labels, headlines and numbers in JetBrains Mono, with tabular numerals for anything compared.
- **Do** use Viridis, Cividis or YlOrRd for every quantitative ramp, with a legend and a "Colorblind-safe" label.
- **Do** pair every status color with its text label and an icon.
- **Do** put a visible `DEMO` or `SIMULATED` badge on every simulated element.
- **Do** use 2–6px corners; save full rounding for dots and toggles.

### Don't:
- **Don't** introduce a light theme or light panels.
- **Don't** use the legacy `flame` scale or brand orange as a data ramp.
- **Don't** add glows, gradients or blur blobs that don't signal a live state (the landing hero's single ambient orange blur is the only exception).
- **Don't** set sentences in uppercase or use Inter for labels and headings.
- **Don't** use 12px+ rounded corners on new panels or controls.
- **Don't** drop readable text below 45% white opacity on near-black (10px text at 40% fails WCAG AA 4.5:1).
