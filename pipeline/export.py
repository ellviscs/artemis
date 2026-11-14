"""Export harmonized FIRMS data as compact static files for the web app (public/data/).

Reads WORK (output of harmonize.py) and writes:
  meta.json                         data range, sensors, calibration, method, counts
  calendar/{regionId}.json          monthly raw / per-sensor / harmonized / anomaly series
  hex/{year}.json                   H3 res-7 cells × month harmonized counts (static heat masked)
  static.json                       persistent static heat sources (for the mask overlay)
  points/{regionId}/{year}.csv.gz   detection-level hotspots for CSV export and the inspector

Usage: python -I pipeline/export.py
"""

from __future__ import annotations

import datetime as dt
import gzip
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from h3.api import basic_int as h3

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harmonize import REGIONS, VIIRS, WORK, month_fraction

OUT = Path(__file__).resolve().parent.parent / "public" / "data"
POINT_REGIONS = [r for r in REGIONS if r != "indonesia"]  # national points are too large to ship statically


def write_json(path: Path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, separators=(",", ":"), ensure_ascii=False, default=float)
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def export_calendars(monthly: pd.DataFrame, cal: dict) -> int:
    size = 0
    fields = [
        "year", "month", "coverage", "raw_points", "modis_points", "viirs_points",
        "modis_celldays", "snpp_celldays", "noaa20_celldays",
        "harmonized", "frp_harmonized", "projected", "z", "pct", "sources",
    ]
    for region in REGIONS:
        variants = {}
        for variant in ("masked", "unmasked"):
            sub = monthly[(monthly["region"] == region) & (monthly["variant"] == variant)].sort_values(["year", "month"])
            rows = []
            for r in sub[fields].itertuples(index=False):
                rows.append([
                    int(r.year), int(r.month), round(float(r.coverage), 3),
                    int(r.raw_points), int(r.modis_points), int(r.viirs_points),
                    int(r.modis_celldays), int(r.snpp_celldays), int(r.noaa20_celldays),
                    round(float(r.harmonized), 1), round(float(r.frp_harmonized)),
                    round(float(r.projected), 1),
                    None if pd.isna(r.z) else float(r.z),
                    None if pd.isna(r.pct) else float(r.pct),
                    int(r.sources),
                ])
            variants[variant] = {
                "baseline": cal["baselines"][region][variant],
                "rows": rows,
            }
        size += write_json(OUT / "calendar" / f"{region}.json", {
            "region": region,
            "columns": [
                "year", "month", "coverage", "rawPoints", "modisPoints", "viirsPoints",
                "modisCellDays", "snppCellDays", "noaa20CellDays",
                "harmonized", "frpHarmonized", "projected", "z", "pct", "sources",
            ],
            "alpha": cal["alpha"][region],
            "variants": variants,
        })
    return size


def export_hex(points: pd.DataFrame, cal: dict) -> int:
    """Masked, harmonized cell-days per H3 res-7 cell and month (national α)."""
    coverage = {s: tuple(dt.date.fromisoformat(d) for d in v) for s, v in cal["coverage"].items()}
    alpha = {s: {int(m): v[0] for m, v in cal["alpha"]["indonesia"][s].items()} for s in VIIRS}
    clean = points[~points["static"]]
    cd = (
        clean.drop_duplicates(["sensor", "h8", "date"])
        .groupby(["year", "month", "h7", "sensor"], observed=True).size().unstack("sensor", fill_value=0)
    )
    for s in ["MODIS", *VIIRS]:
        if s not in cd.columns:
            cd[s] = 0
    cd = cd.reset_index()
    size = 0
    for year, part in cd.groupby("year"):
        year = int(year)
        weights = {}
        for month in range(1, 13):
            elapsed = month_fraction(year, month, dt.date(2000, 11, 1), dt.date.today())
            cov = {s: month_fraction(year, month, *coverage[s]) for s in coverage}
            srcs = [s for s in ["MODIS", *VIIRS] if elapsed > 0 and cov[s] / elapsed >= 0.5]
            if not srcs:
                continue
            weights[month] = [(s, (1.0 if s == "MODIS" else alpha[s][month]) / len(srcs)) for s in srcs]
        value = np.zeros(len(part))
        months = part["month"].to_numpy()
        for month, ws in weights.items():
            sel = months == month
            for s, w in ws:
                value[sel] += w * part.loc[sel, s].to_numpy()
        keep = value > 0
        part = part[keep]
        value = value[keep]
        cells = pd.unique(part["h7"])
        index = {c: i for i, c in enumerate(cells)}
        size += write_json(OUT / "hex" / f"{year}.json", {
            "year": year,
            "resolution": 7,
            "cells": [h3.int_to_str(int(c)) for c in cells],
            "cell": [index[c] for c in part["h7"]],
            "month": part["month"].astype(int).tolist(),
            "value": [round(float(v), 2) for v in value],
        })
    return size


def export_static(persistent: pd.DataFrame, points: pd.DataFrame) -> int:
    typed = points[points["static_reason"] == "firms-type"]
    typed_cells = typed.groupby("h8").agg(lat=("lat", "median"), lon=("lon", "median"), n=("frp", "size"), type=("type", "max"))
    sources = []
    for h8, r in persistent.groupby("h8"):
        sources.append({
            "cell": h3.int_to_str(int(h8)), "lat": round(float(r["lat"].median()), 4), "lon": round(float(r["lon"].median()), 4),
            "reason": "persistent", "years": sorted(int(y) for y in r["year"]), "maxDays": int(r["days"].max()),
        })
    for h8, r in typed_cells.iterrows():
        sources.append({
            "cell": h3.int_to_str(int(h8)), "lat": round(float(r["lat"]), 4), "lon": round(float(r["lon"]), 4),
            "reason": {1: "volcano", 2: "static-land", 3: "offshore"}.get(int(r["type"]), "firms-type"), "detections": int(r["n"]),
        })
    return write_json(OUT / "static.json", {"count": len(sources), "sources": sources})


def export_points(points: pd.DataFrame) -> dict:
    sizes = {}
    cols = ["date", "time", "lat", "lon", "sensor", "satellite", "conf", "frp", "bright", "scan", "track", "dn", "static"]
    for region in POINT_REGIONS:
        pname = REGIONS[region]
        sub = points[points["province"] == pname]
        total = 0
        for year, part in sub.groupby("year"):
            out = part[cols].sort_values(["date", "time"]).copy()
            out["date"] = out["date"].dt.strftime("%Y-%m-%d")
            # Fixed 4 decimals (~11 m) as text: the "%.4g" float format below would cut
            # coordinates to 4 significant digits (112.66777 -> 112.7, ~5 km off).
            out["lat"] = out["lat"].map("{:.4f}".format)
            out["lon"] = out["lon"].map("{:.4f}".format)
            out["static"] = out["static"].astype(int)
            path = OUT / "points" / region / f"{int(year)}.csv.gz"
            path.parent.mkdir(parents=True, exist_ok=True)
            # newline="" + "\n" terminator: on Windows both pandas and text mode would
            # otherwise add "\r", giving "\r\r\n" line ends.
            with gzip.open(path, "wt", encoding="utf-8", compresslevel=9, newline="") as f:
                out.to_csv(f, index=False, float_format="%.4g", lineterminator="\n")
            total += path.stat().st_size
        sizes[region] = total
    return sizes


def main() -> None:
    cal = json.loads((WORK / "calibration.json").read_text())
    monthly = pd.read_parquet(WORK / "monthly.parquet")
    points = pd.read_parquet(WORK / "points.parquet")
    persistent = pd.read_parquet(WORK / "persistent.parquet")

    # Overwrite in place (OneDrive can lock folders, so never delete the tree).
    OUT.mkdir(parents=True, exist_ok=True)

    sizes = {
        "calendar": export_calendars(monthly, cal),
        "hex": export_hex(points, cal),
        "static": export_static(persistent, points),
    }
    point_sizes = export_points(points)
    sizes["points"] = sum(point_sizes.values())

    years = sorted(int(y) for y in monthly["year"].unique())
    bounds = json.loads((WORK / "province_bounds.json").read_text())
    write_json(OUT / "meta.json", {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "range": {"start": "2000-11-01", "end": cal["coverage"]["MODIS"][1], "years": [years[0], years[-1]]},
        "sensors": {
            "MODIS": {"label": "MODIS C6.1 (Terra + Aqua)", "resolution": "1 km", "coverage": cal["coverage"]["MODIS"]},
            "SNPP": {"label": "VIIRS Suomi-NPP", "resolution": "375 m", "coverage": cal["coverage"]["SNPP"], "note": "Delivery ended 2 Nov 2026; archive only."},
            "NOAA20": {"label": "VIIRS NOAA-20", "resolution": "375 m", "coverage": cal["coverage"]["NOAA20"]},
        },
        "unit": "Fire cell-days: unique H3 resolution-8 cell (~0.74 km²) × day with ≥1 detection, per sensor.",
        "harmonization": {
            "method": cal["method"],
            "formula": "H = mean(MODIS, α_SNPP[m]·SNPP, α_NOAA20[m]·NOAA20) over sensors covering ≥50% of the month; MODIS only before 2012.",
            "pooledAlpha": cal["pooled"],
            "goodnessOfFit": cal["goodnessOfFit"],
        },
        "anomaly": {
            "baselineYears": [2001, 2025],
            "formula": "Z = (H − median) / IQR of the same calendar month (std if IQR is 0); partial months are projected to a full month first.",
        },
        "staticMask": {
            "rule": "FIRMS type 1 (volcano), 2 (static land source), 3 (offshore), plus H3 res-8 cells with detections on >60 distinct days across ≥8 calendar months in one year.",
            "sources": json.loads((OUT / "static.json").read_text())["count"],
            "detections": cal["staticDetections"],
        },
        "totals": {"detections": cal["totalDetections"]},
        "regions": {
            r: {"province": p, "bounds": bounds.get(p) if p else None, "points": r in POINT_REGIONS}
            for r, p in REGIONS.items()
        },
        "attribution": [
            "NASA FIRMS (MODIS C6.1, VIIRS 375 m) — https://firms.modaps.eosdis.nasa.gov",
            "geoBoundaries IDN ADM1 (CC BY 4.0) — https://www.geoboundaries.org",
        ],
    })

    print("Sizes (MB):", {k: round(v / 1e6, 2) for k, v in sizes.items()})
    print("Points per region (MB):", {k: round(v / 1e6, 2) for k, v in point_sizes.items()})
    total = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file()) / 1e6
    print(f"Total public/data: {total:.1f} MB")


if __name__ == "__main__":
    import sys as _sys
    _sys.stdout.reconfigure(encoding="utf-8")
    main()
