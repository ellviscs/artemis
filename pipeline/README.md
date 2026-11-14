# Artemis data pipeline

Turns the real NASA FIRMS archive for Indonesia (2000 → today) into the static, harmonized files the web app reads from `public/data/`.

```bash
python -m pip install -r pipeline/requirements.txt
python -I pipeline/fetch_archive.py   # ~1 GB download, resumable
python -I pipeline/harmonize.py       # clip, grid, mask, calibrate, anomalies
python -I pipeline/export.py          # write public/data/
python -I pipeline/forensics.py       # anthropogenic thermal signature tiles
```

`FIRMS_API_KEY` is read from the environment or `Artemis-master/.env`. Raw and intermediate files live in `%LOCALAPPDATA%/artemis-pipeline/` (override with `ARTEMIS_RAW_DIR` / `ARTEMIS_WORK_DIR`), outside OneDrive and git.

## Sources

| Data | Source | Period |
|---|---|---|
| MODIS C6.1 (Terra + Aqua), 1 km | FIRMS yearly country files; 2026 via Area API (SP, then NRT) | Nov 2000 → today |
| VIIRS Suomi-NPP, 375 m | FIRMS yearly country files; 2026 via Area API | Jan 2012 → 2 Nov 2026 (delivery ended) |
| VIIRS NOAA-20, 375 m | FIRMS yearly country files; 2026 via Area API | Apr 2018 → today |
| Indonesian province boundaries | geoBoundaries gbOpen IDN ADM1 (CC BY 4.0) | — |

## Method

1. **Clip and assign provinces.** Each detection is assigned to the geoBoundaries province containing it (or the nearest one within 0.05°, for coastal pixels just outside the simplified polygons). Points farther away are dropped, so the 2026 bounding-box downloads match the country-clipped yearly files.
2. **Grid.** Detections are indexed to H3 resolution 8 (~0.74 km²) and resolution 7 (~5.2 km²).
3. **Static heat mask.** A detection is masked if FIRMS marks it `type` 1 (volcano), 2 (static land source) or 3 (offshore), or if its res-8 cell has detections on more than 60 distinct days spread across at least 8 calendar months of the same year (refineries, smelters, flares burn in both wet and dry seasons; real vegetation fires don't).
4. **Count fire cell-days.** For each sensor, the unit is a unique res-8 cell × day with at least one detection. This removes VIIRS's tendency to record several 375 m pixels for one fire that MODIS sees as a single 1 km pixel.
5. **Calibrate VIIRS to MODIS-equivalent units.** For each VIIRS platform and calendar month, α is the median of monthly MODIS / VIIRS cell-day ratios over full overlap months (masked data, both sensors ≥ 10 cell-days). Provinces get their own α for a month when they have ≥ 6 overlap years with ≥ 30 cell-days in both sensors and the value stays within 0.5–2× the national α; otherwise the national α is used (low-fire months produce noisy ratios). FRP uses the same procedure.
6. **Harmonize.** Before 2012 the series is MODIS alone. After that it's the mean of every sensor covering at least half the month: MODIS, α·S-NPP, α·NOAA-20. When MODIS ends, the VIIRS platforms carry the series in the same units.
7. **Anomalies.** For each region and calendar month, the 2001–2025 harmonized values give the median and IQR. `Z = (H − median) / IQR` (std if the IQR is 0). The current partial month is projected to a full month before comparison.

Outputs in `%LOCALAPPDATA%/artemis-pipeline/work/` include `calibration.json` (all α with goodness of fit) and `validation_annual.png` (raw vs harmonized annual totals).

## Output files (`public/data/`)

| File | Contents |
|---|---|
| `meta.json` | Date range, sensors, method, pooled α, goodness of fit, mask rule, attribution |
| `calendar/{region}.json` | Monthly raw / per-sensor / harmonized / anomaly rows, masked and unmasked, with baselines |
| `hex/{year}.json` | H3 res-7 cells × month harmonized values (masked) |
| `static.json` | Static heat sources removed by the mask |
| `points/{region}/{year}.csv.gz` | Detection-level hotspots for the five priority provinces |
| `forensics/{res3}.json` | Signature score, percentile, four features and yearly history per res-7 cell, tiled by H3 res-3 parent |

Regions: `indonesia`, `id-riau`, `id-jambi`, `id-south-sumatra`, `id-west-kalimantan`, `id-central-kalimantan`. National point files aren't shipped (too large for static hosting); national CSV export uses the monthly analytics.

## Anthropogenic Thermal Signature (`forensics.py`)

A transparent, rule-based score per H3 res-7 cell (~5 km²) with at least 3 active cell-days since 2001. It is **not a trained model** and not a calibrated probability; each cell also gets its national percentile.

| Feature | Weight | Definition |
|---|---|---|
| Off-season burning | 0.30 | Mean of (1 − provincial MODIS monthly median ÷ peak-month median) over the cell's detections; months that were provincial drought anomalies (Z ≥ 1) count half |
| Geometric regularity | 0.20 | Median PCA elongation 1 − λ₂/λ₁ of same-day VIIRS detections, on days with ≥ 5 detections |
| Afternoon timing | 0.15 | Share of detections at local solar 12:00–18:00, ranked within the province (raw share mostly reflects the shared overpass schedule) |
| Multi-year recurrence | 0.35 | 0.6 · min(active years ÷ 10, 1) + 0.4 · share of gaps between burn years lasting 3–5 years |

Score = 100 · Σ weight · feature. Indonesia-wide quantiles: median ≈ 38, 90th percentile ≈ 53, 99th ≈ 62.

**Planned validation (weak supervision).** Labels would come from post-fire back-labelling: a cluster burned in year T followed by permanent forest loss (Global Forest Watch, MODIS burned area MCD64A1) and a geometric plantation NDVI pattern at T+1/T+2 → land clearing; natural vegetation regrowth and a match with El Niño drought → climate-driven fire. Those labels would fit the weights (or a classifier) instead of the hand-set values above. NDVI and forest-loss data are not part of this build.

**Caveats.** VIIRS scan geometry can make small clusters look linear; peat fires are largely human-ignited yet burn in the dry season, so a low score does not mean "natural". The score flags patterns for field verification; it never identifies who lit a fire.

## Limitations

- The harmonized series is a statistical calibration, not a re-detection: α captures the average sensitivity difference per calendar month, not per fire.
- MODIS Terra's orbit has been drifting since 2020, which changes its overpass times; the multi-sensor mean dampens but doesn't remove that effect.
- 2026 S-NPP and NOAA-20 data after July come from near-real-time products, which FIRMS later reprocesses.
