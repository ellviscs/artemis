"""Anthropogenic Thermal Signature features per H3 resolution-7 cell (~5 km²).

A transparent, rule-based score — NOT a trained model. Four features, each scaled 0–1,
computed from the real FIRMS archive (static heat masked), following GEMINI Handover §2B:

1. Off-season burning (weight 0.30)
   Share of the cell's detections that fall in climatologically low-fire months for its
   province (1 − provincial MODIS monthly median / peak-month median), down-weighted by half
   when that province-month was itself a drought anomaly (Z ≥ 1), because drought can make
   off-season fires natural.
2. Geometric regularity (weight 0.20)
   For cell-days with ≥5 VIIRS 375 m detections, PCA elongation 1 − λ₂/λ₁ of the detection
   coordinates (0 = round cluster, 1 = a straight line). Median over those days. Linear rows
   and grid perimeters push it up; elliptical wind-driven spread keeps it lower.
3. Afternoon overpass share (weight 0.15)
   Share of detections at local solar time 12:00–18:00 (Aqua / VIIRS ~13:30 overpass) versus
   all overpasses, expressed as a percentile rank within the cell's province (every cell shares
   the same satellite schedule, so only the relative share is informative). Managed clearing burns are lit in the afternoon and are usually out by the
   night pass; long-smouldering fires keep appearing at night.
4. Multi-year recurrence (weight 0.35)
   0.6 · min(active years / 10, 1) + 0.4 · share of gaps between active years lasting 3–5 years
   (the clearing → planting → re-clearing cycle).

Score = 100 · Σ wᵢ · featureᵢ. Labels for a supervised version would come from post-fire
NDVI / forest-loss back-labelling (see README); that data is not part of this build.

Writes public/data/forensics/{res3-parent}.json tiles.
Usage: python -I pipeline/forensics.py   (after harmonize.py)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from h3.api import basic_int as h3

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harmonize import WORK  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "forensics"
WEIGHTS = {"offSeason": 0.30, "geometry": 0.20, "timing": 0.15, "recurrence": 0.35}
YEARS = list(range(2001, 2027))
MIN_ACTIVE_DAYS = 3
MIN_GEOMETRY_POINTS = 5


def province_climatology(df: pd.DataFrame) -> pd.DataFrame:
    """Per province × month: off-season weight; per province × year × month: drought Z."""
    modis = df[df["sensor"] == "MODIS"]
    counts = modis.groupby(["province", "year", "month"], observed=True).size().rename("n").reset_index()
    full = pd.MultiIndex.from_product(
        [counts["province"].unique(), range(2001, 2027), range(1, 13)], names=["province", "year", "month"]
    )
    counts = counts.set_index(["province", "year", "month"]).reindex(full, fill_value=0).reset_index()
    base = counts[counts["year"] <= 2025].groupby(["province", "month"])["n"].agg(
        median="median", q25=lambda s: s.quantile(0.25), q75=lambda s: s.quantile(0.75), std="std"
    ).reset_index()
    peak = base.groupby("province")["median"].transform("max").replace(0, np.nan)
    base["off_season"] = (1 - base["median"] / peak).fillna(1).clip(0, 1)
    counts = counts.merge(base, on=["province", "month"])
    spread = (counts["q75"] - counts["q25"]).where(lambda s: s > 0, counts["std"]).replace(0, np.nan)
    counts["z"] = ((counts["n"] - counts["median"]) / spread).fillna(0)
    return counts[["province", "year", "month", "off_season", "z"]]


def geometry_feature(df: pd.DataFrame) -> pd.Series:
    v = df[df["sensor"] != "MODIS"][["h7", "date", "lat", "lon"]].copy()
    v["x"] = v["lon"] * 111.32 * np.cos(np.radians(v["lat"]))
    v["y"] = v["lat"] * 110.57
    g = v.groupby(["h7", "date"])
    agg = g.agg(n=("x", "size"), mx=("x", "mean"), my=("y", "mean"), vx=("x", "var"), vy=("y", "var"))
    agg["cxy"] = g.apply(lambda d: np.cov(d["x"], d["y"])[0, 1] if len(d) >= MIN_GEOMETRY_POINTS else np.nan, include_groups=False)
    agg = agg[agg["n"] >= MIN_GEOMETRY_POINTS].dropna()
    tr = agg["vx"] + agg["vy"]
    det = agg["vx"] * agg["vy"] - agg["cxy"] ** 2
    disc = np.sqrt(np.maximum(tr**2 / 4 - det, 0))
    l1 = tr / 2 + disc
    l2 = np.maximum(tr / 2 - disc, 0)
    agg["linearity"] = np.where(l1 > 0, 1 - l2 / l1, 0)
    return agg.groupby("h7")["linearity"].median()


def main() -> None:
    cols = ["h7", "h8", "date", "time", "lat", "lon", "sensor", "province", "year", "month", "static", "frp", "dn"]
    df = pd.read_parquet(WORK / "points.parquet", columns=cols)
    df = df[~df["static"] & (df["year"] >= 2001)].copy()
    print(f"{len(df):,} masked detections", flush=True)

    # Cell-days (dedupe across sensors at res-8, then count per res-7 cell)
    cd = df.drop_duplicates(["h8", "date"])
    active_days = cd.groupby("h7").size()
    keep = active_days[active_days >= MIN_ACTIVE_DAYS].index
    df = df[df["h7"].isin(keep)]
    cd = cd[cd["h7"].isin(keep)]
    print(f"{len(keep):,} cells with ≥{MIN_ACTIVE_DAYS} active cell-days", flush=True)

    # 1. Off-season
    clim = province_climatology(df)
    m = df[["h7", "province", "year", "month"]].merge(clim, on=["province", "year", "month"], how="left")
    m["w"] = m["off_season"].fillna(0.5) * np.where(m["z"] >= 1, 0.5, 1.0)
    off = m.groupby("h7")["w"].mean()

    # 2. Geometry
    print("geometry…", flush=True)
    geom = geometry_feature(df)

    # 3. Timing (local solar time from UTC + longitude)
    hh = df["time"].str[:2].astype(int) + df["time"].str[2:].astype(int) / 60
    local = (hh + df["lon"] / 15) % 24
    timing = (local.between(12, 18)).groupby(df["h7"]).mean()
    night = (df["dn"] == "N").groupby(df["h7"]).mean()

    # 4. Recurrence + yearly series
    yearly = cd.groupby(["h7", "year"]).size().unstack(fill_value=0).reindex(columns=YEARS, fill_value=0)
    active = yearly > 0
    n_active = active.sum(axis=1)

    def cycle_share(row: np.ndarray) -> float:
        yrs = np.flatnonzero(row)
        if len(yrs) < 2:
            return 0.0
        gaps = np.diff(yrs)
        return float(((gaps >= 3) & (gaps <= 5)).mean())

    cycles = pd.Series([cycle_share(r) for r in active.to_numpy()], index=active.index)
    recur = 0.6 * np.minimum(n_active / 10, 1) + 0.4 * cycles

    # Overpass times are shared by every cell, so raw afternoon share mostly reflects the satellite
    # schedule. Rank it within the province instead: 1 = most afternoon-heavy cell in its province.
    prov_of = df.groupby("h7")["province"].agg(lambda s: s.mode().iat[0])
    timing_raw = timing.copy()
    timing = timing.groupby(prov_of.reindex(timing.index)).rank(pct=True)

    feats = pd.DataFrame({
        "offSeason": off, "geometry": geom, "timing": timing, "recurrence": recur,
        "activeYears": n_active, "cycleShare": cycles, "nightShare": night, "afternoonShare": timing_raw,
    }).reindex(keep)
    feats["geometryDays"] = feats["geometry"].notna()
    feats["geometry"] = feats["geometry"].fillna(0)
    feats = feats.fillna(0)
    feats["score"] = sum(WEIGHTS[k] * feats[k] for k in WEIGHTS) * 100
    feats["percentile"] = feats["score"].rank(pct=True) * 100

    last = cd.groupby("h7")["date"].max().dt.strftime("%Y-%m-%d")
    maxfrp = df.groupby("h7")["frp"].max()
    prov = prov_of

    # Tiles by H3 res-3 parent (~12,000 km²) so the browser loads only the area it needs.
    OUT.mkdir(parents=True, exist_ok=True)
    feats["tile"] = [h3.cell_to_parent(int(c), 3) for c in feats.index]
    sizes = []
    for tile, part in feats.groupby("tile"):
        cells = {}
        for c, r in part.iterrows():
            cells[h3.int_to_str(int(c))] = [
                round(r["score"], 1), round(r["percentile"], 1), round(r["offSeason"], 3), round(r["geometry"], 3) if r["geometryDays"] else None,
                round(r["timing"], 3), round(r["recurrence"], 3), int(r["activeYears"]), round(r["cycleShare"], 2),
                round(r["nightShare"], 2), round(r["afternoonShare"], 2), last.get(c, ""), round(float(maxfrp.get(c, 0)), 1), str(prov.get(c, "")),
                yearly.loc[c].astype(int).tolist(),
            ]
        text = json.dumps({
            "columns": ["score", "percentile", "offSeason", "geometry", "timing", "recurrence", "activeYears", "cycleShare",
                        "nightShare", "afternoonShare", "lastActive", "maxFrp", "province", "yearly"],
            "years": YEARS,
            "cells": cells,
        }, separators=(",", ":"))
        (OUT / f"{h3.int_to_str(int(tile))}.json").write_text(text, encoding="utf-8")
        sizes.append(len(text))
    (OUT / "index.json").write_text(json.dumps({
        "weights": WEIGHTS,
        "tileResolution": 3,
        "cellResolution": 7,
        "minActiveDays": MIN_ACTIVE_DAYS,
        "method": "rule-based",
        "scoreQuantiles": {q: round(float(feats["score"].quantile(q)), 1) for q in (0.1, 0.25, 0.5, 0.75, 0.9, 0.99)},
    }, indent=1), encoding="utf-8")
    print(f"{len(sizes)} tiles, {sum(sizes) / 1e6:.1f} MB; score quantiles:",
          {q: round(float(feats['score'].quantile(q)), 1) for q in (0.1, 0.5, 0.9, 0.99)}, flush=True)
    print("feature means:", feats[list(WEIGHTS)].mean().round(3).to_dict(), flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
