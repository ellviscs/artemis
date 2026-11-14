"""Harmonize the FIRMS MODIS + VIIRS archive for Indonesia into one consistent series.

Steps (see ../GEMINI Handover.md §2A and §3 holes #1–#2):
1. Load every raw CSV (MODIS, VIIRS S-NPP, VIIRS NOAA-20), normalise columns, drop duplicates.
2. Clip to Indonesia and assign a province with geoBoundaries ADM1 polygons.
3. Grid every detection to H3 resolution 8 (~0.74 km² cells) and resolution 7 (~5.2 km²).
4. Static heat mask: FIRMS type 1/2/3 (volcano, static land source, offshore) plus
   "persistent" cells burning on >60 distinct days in a year across ≥8 calendar months.
5. Count fire cell-days (unique cell × date) per sensor, region and month.
6. Calibrate each VIIRS platform to MODIS-equivalent units with a robust per-calendar-month
   ratio α (median of monthly MODIS/VIIRS ratios over the overlap period), per region when
   the region has enough overlap months, otherwise the national α for that month.
7. Harmonized series H = MODIS before VIIRS exists; afterwards the mean of all available
   MODIS-equivalent estimates (MODIS, α·S-NPP, α·NOAA-20).
8. Anomalies vs the 2001–2025 calendar-month baseline: Z = (H − median) / IQR.

Outputs go to WORK (default %LOCALAPPDATA%/artemis-pipeline/work):
  points.parquet   every Indonesian detection with province, cells, mask flags
  monthly.parquet  region × month × variant aggregates
  calibration.json fitted α per region/sensor/month with goodness of fit
  validation_annual.png  raw vs harmonized annual totals (Indonesia)

Usage: python -I pipeline/harmonize.py
"""

from __future__ import annotations

import calendar
import datetime as dt
import json
import os
from pathlib import Path

from h3.api import basic_int as h3
import numpy as np
import pandas as pd
import shapely
from shapely.geometry import shape

LOCAL = Path(os.environ.get("LOCALAPPDATA", Path(__file__).resolve().parent)) / "artemis-pipeline"
RAW = Path(os.environ.get("ARTEMIS_RAW_DIR") or LOCAL / "raw")
WORK = Path(os.environ.get("ARTEMIS_WORK_DIR") or LOCAL / "work")

SENSORS = {"modis": "MODIS", "viirs-snpp": "SNPP", "viirs-jpss1": "NOAA20"}
VIIRS = ["SNPP", "NOAA20"]
BASELINE_YEARS = range(2001, 2026)  # complete years used for the historical baseline
CLIP_BUFFER_DEG = 0.05  # keep coastal detections just outside the simplified polygons
STATIC_MIN_DAYS = 60
STATIC_MIN_MONTHS = 8
MIN_OVERLAP_COUNT = 10  # minimum cell-days in both sensors for a month to enter the fit
MIN_REGION_PAIRS = 6  # region-specific α needs this many overlap years for that month
MIN_REGION_COUNT = 30  # ...each with ≥30 cell-days in both sensors (low-fire months are noise)
ALPHA_GUARD = (0.5, 2.0)  # region α must stay within this factor of the national α for that month

# Regions shipped to the app: id -> geoBoundaries shapeName (None = all of Indonesia)
REGIONS = {
    "indonesia": None,
    "id-riau": "Riau",
    "id-jambi": "Jambi",
    "id-south-sumatra": "South Sumatra",
    "id-west-kalimantan": "West Kalimantan",
    "id-central-kalimantan": "Central Kalimantan",
}

CONF_MAP = {"l": 30, "n": 60, "h": 90}


# ─── 1. Load ────────────────────────────────────────────────────────────────────

def read_csv(path: Path, sensor: str) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    if df.empty or "latitude" not in df.columns:
        return pd.DataFrame()
    bright_col = "brightness" if "brightness" in df.columns else "bright_ti4"
    conf = df["confidence"].str.strip().str.lower()
    conf_num = pd.to_numeric(conf, errors="coerce")
    conf_num = conf_num.fillna(conf.map(CONF_MAP))
    out = pd.DataFrame({
        "lat": pd.to_numeric(df["latitude"], errors="coerce"),
        "lon": pd.to_numeric(df["longitude"], errors="coerce"),
        "date": pd.to_datetime(df["acq_date"], errors="coerce"),
        "time": df["acq_time"].str.zfill(4),
        "sensor": sensor,
        "satellite": df.get("satellite", pd.Series("", index=df.index)),
        "conf": conf_num.astype("float32"),
        "frp": pd.to_numeric(df["frp"], errors="coerce").astype("float32"),
        "bright": pd.to_numeric(df[bright_col], errors="coerce").astype("float32"),
        "scan": pd.to_numeric(df.get("scan"), errors="coerce").astype("float32"),
        "track": pd.to_numeric(df.get("track"), errors="coerce").astype("float32"),
        "dn": df.get("daynight", pd.Series("", index=df.index)).str.upper(),
        "type": pd.to_numeric(df["type"], errors="coerce") if "type" in df.columns else np.nan,
    })
    return out.dropna(subset=["lat", "lon", "date", "frp"])


def load_all() -> pd.DataFrame:
    frames = []
    for folder, sensor in SENSORS.items():
        files = sorted((RAW / folder).rglob("*.csv"))
        for path in files:
            frames.append(read_csv(path, sensor))
        print(f"  loaded {sensor}: {len(files)} files", flush=True)
    df = pd.concat([f for f in frames if not f.empty], ignore_index=True)
    before = len(df)
    df = df.drop_duplicates(subset=["sensor", "lat", "lon", "date", "time"])
    print(f"  {before:,} rows, {before - len(df):,} duplicates dropped (overlapping API windows)", flush=True)
    return df


# ─── 2. Clip + provinces ────────────────────────────────────────────────────────

def assign_provinces(df: pd.DataFrame) -> pd.DataFrame:
    gj = json.loads((RAW / "idn_adm1.geojson").read_text(encoding="utf-8"))
    names = [f["properties"]["shapeName"] for f in gj["features"]]
    polys = [shape(f["geometry"]) for f in gj["features"]]
    tree = shapely.STRtree(polys)
    pts = shapely.points(df["lon"].to_numpy(), df["lat"].to_numpy())

    province = np.full(len(df), -1, dtype=np.int16)
    pidx, gidx = tree.query(pts, predicate="within")
    province[pidx] = gidx
    missing = np.flatnonzero(province < 0)
    if len(missing):
        near_p, near_g = tree.query_nearest(pts[missing], max_distance=CLIP_BUFFER_DEG, return_distance=False)
        province[missing[near_p]] = near_g
    keep = province >= 0
    print(f"  clipped to Indonesia: kept {keep.sum():,} of {len(df):,}", flush=True)
    df = df.loc[keep].copy()
    df["province"] = pd.Categorical.from_codes(province[keep], categories=names)

    bounds = {}
    for name, poly in zip(names, polys):
        minx, miny, maxx, maxy = poly.bounds
        bounds[name] = [round(miny, 3), round(minx, 3), round(maxy, 3), round(maxx, 3)]
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "province_bounds.json").write_text(json.dumps(bounds, indent=1))
    return df


# ─── 3. Grid ────────────────────────────────────────────────────────────────────

def add_cells(df: pd.DataFrame) -> pd.DataFrame:
    lat = df["lat"].to_numpy()
    lon = df["lon"].to_numpy()
    df["h8"] = [h3.latlng_to_cell(a, b, 8) for a, b in zip(lat, lon)]
    parents = {c: h3.cell_to_parent(c, 7) for c in pd.unique(df["h8"])}
    df["h7"] = df["h8"].map(parents)
    df["year"] = df["date"].dt.year.astype("int16")
    df["month"] = df["date"].dt.month.astype("int8")
    return df


# ─── 4. Static heat mask ────────────────────────────────────────────────────────

def static_mask(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    typed = df["type"].isin([1, 2, 3])
    days = df.groupby(["h8", "year"]).agg(
        days=("date", "nunique"), months=("month", "nunique"),
        lat=("lat", "median"), lon=("lon", "median"),
    ).reset_index()
    persistent = days[(days["days"] > STATIC_MIN_DAYS) & (days["months"] >= STATIC_MIN_MONTHS)]
    flag = persistent[["h8", "year"]].assign(_p=True)
    is_persistent = df[["h8", "year"]].merge(flag, on=["h8", "year"], how="left")["_p"].fillna(False).to_numpy()
    is_persistent = pd.Series(is_persistent, index=df.index)
    df["static"] = (typed | is_persistent).to_numpy()
    df["static_reason"] = np.where(typed, "firms-type", np.where(is_persistent, "persistent", ""))
    print(
        f"  static heat: {typed.sum():,} FIRMS type 1/2/3 detections, "
        f"{len(persistent):,} persistent cell-years ({is_persistent.sum():,} detections)",
        flush=True,
    )
    return df, persistent


# ─── 5. Monthly aggregates ──────────────────────────────────────────────────────

def monthly_counts(df: pd.DataFrame) -> pd.DataFrame:
    """Per region × variant × year × month × sensor: raw points, cell-days, FRP."""
    rows = []
    for variant, sub in (("unmasked", df), ("masked", df[~df["static"]])):
        for region, pname in REGIONS.items():
            part = sub if pname is None else sub[sub["province"] == pname]
            g = part.groupby(["year", "month", "sensor"], observed=True)
            agg = g.agg(points=("frp", "size"), frp=("frp", "sum")).reset_index()
            cd = (
                part.drop_duplicates(["sensor", "h8", "date"])
                .groupby(["year", "month", "sensor"], observed=True).size().rename("celldays").reset_index()
            )
            agg = agg.merge(cd, on=["year", "month", "sensor"], how="left")
            agg["region"] = region
            agg["variant"] = variant
            rows.append(agg)
    out = pd.concat(rows, ignore_index=True)
    return out.pivot_table(
        index=["region", "variant", "year", "month"], columns="sensor",
        values=["points", "celldays", "frp"], fill_value=0,
    )


def sensor_coverage(df: pd.DataFrame) -> dict[str, tuple[dt.date, dt.date]]:
    cov = df.groupby("sensor")["date"].agg(["min", "max"])
    return {s: (r["min"].date(), r["max"].date()) for s, r in cov.iterrows()}


def month_fraction(year: int, month: int, lo: dt.date, hi: dt.date) -> float:
    """Fraction of a calendar month inside [lo, hi]."""
    first = dt.date(year, month, 1)
    last = dt.date(year, month, calendar.monthrange(year, month)[1])
    a, b = max(first, lo), min(last, hi)
    return max(0, (b - a).days + 1) / ((last - first).days + 1)


# ─── 6. Calibration ─────────────────────────────────────────────────────────────

def fit_alpha(table: pd.DataFrame, coverage: dict, metric: str = "celldays") -> dict:
    """α[region][sensor][month] mapping VIIRS → MODIS-equivalent, fitted on masked data."""
    result: dict = {}
    t = table.xs("masked", level="variant")
    for sensor in VIIRS:
        lo, hi = coverage[sensor]
        for region in REGIONS:
            r = t.xs(region, level="region")
            m = r[(metric, "MODIS")]
            v = r[(metric, sensor)]
            full = [
                (y, mo) for (y, mo) in r.index
                if y < 2026 and month_fraction(y, mo, lo, hi) == 1 and month_fraction(y, mo, *coverage["MODIS"]) == 1
            ]
            pairs = pd.DataFrame({"m": m.loc[full], "v": v.loc[full]})
            floor = MIN_OVERLAP_COUNT if region == "indonesia" else MIN_REGION_COUNT
            pairs = pairs[(pairs["m"] >= floor) & (pairs["v"] >= floor)]
            pairs["ratio"] = pairs["m"] / pairs["v"]
            pooled = float(pairs["m"].sum() / pairs["v"].sum()) if len(pairs) else None
            by_month = {}
            for mo in range(1, 13):
                sel = pairs[pairs.index.get_level_values(1) == mo]
                by_month[mo] = {"alpha": float(sel["ratio"].median()) if len(sel) else None, "n": int(len(sel))}
            result.setdefault(region, {})[sensor] = {"pooled": pooled, "months": by_month, "pairs": int(len(pairs))}

    # Fallbacks: region month → national month → national pooled
    final: dict = {}
    for region in REGIONS:
        for sensor in VIIRS:
            nat = result["indonesia"][sensor]
            reg = result[region][sensor]
            alphas = {}
            for mo in range(1, 13):
                rm = reg["months"][mo]
                nm = nat["months"][mo]
                plausible = (
                    rm["alpha"] is not None and nm["alpha"] is not None
                    and ALPHA_GUARD[0] * nm["alpha"] <= rm["alpha"] <= ALPHA_GUARD[1] * nm["alpha"]
                )
                if plausible and rm["n"] >= MIN_REGION_PAIRS:
                    alphas[mo] = (rm["alpha"], "region-month")
                elif nm["alpha"] is not None and nm["n"] >= 3:
                    alphas[mo] = (nm["alpha"], "national-month")
                else:
                    alphas[mo] = (nat["pooled"], "national-pooled")
            final.setdefault(region, {})[sensor] = alphas
    return {"raw": result, "final": final}


def harmonize(table: pd.DataFrame, alpha: dict, frp_alpha: dict, coverage: dict) -> pd.DataFrame:
    recs = []
    today = dt.date.today()
    for (region, variant, year, month), row in table.iterrows():
        frac_month = month_fraction(year, month, dt.date(2000, 11, 1), today)
        cov = {s: month_fraction(year, month, *coverage[s]) for s in coverage}
        # A sensor counts when it covers ≥50% of the elapsed part of the month.
        usable = {s: frac_month > 0 and cov[s] / frac_month >= 0.5 for s in coverage}
        estimates, frp_estimates = [], []
        if usable["MODIS"]:
            estimates.append(row[("celldays", "MODIS")] / cov["MODIS"] * frac_month)
            frp_estimates.append(row[("frp", "MODIS")] / cov["MODIS"] * frac_month)
        for s in VIIRS:
            if usable[s]:
                a = alpha[region][s][month][0]
                fa = frp_alpha[region][s][month][0]
                estimates.append(a * row[("celldays", s)] / cov[s] * frac_month)
                frp_estimates.append(fa * row[("frp", s)] / cov[s] * frac_month)
        recs.append({
            "region": region, "variant": variant, "year": year, "month": month,
            "coverage": round(frac_month, 3),
            "raw_points": int(sum(row[("points", s)] for s in ["MODIS", *VIIRS])),
            "modis_points": int(row[("points", "MODIS")]),
            "viirs_points": int(row[("points", "SNPP")] + row[("points", "NOAA20")]),
            "modis_celldays": int(row[("celldays", "MODIS")]),
            "snpp_celldays": int(row[("celldays", "SNPP")]),
            "noaa20_celldays": int(row[("celldays", "NOAA20")]),
            "harmonized": float(np.mean(estimates)) if estimates else 0.0,
            "frp_harmonized": float(np.mean(frp_estimates)) if frp_estimates else 0.0,
            "sources": len(estimates),
        })
    return pd.DataFrame(recs)


def fill_missing_months(h: pd.DataFrame) -> pd.DataFrame:
    """Months with zero detections never appear in the groupby; add them as explicit zeros."""
    today = dt.date.today()
    idx = []
    for region in REGIONS:
        for variant in ("masked", "unmasked"):
            y, m = 2000, 11
            while (y, m) <= (today.year, today.month):
                idx.append((region, variant, y, m))
                y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    full = pd.DataFrame(idx, columns=["region", "variant", "year", "month"])
    out = full.merge(h, on=["region", "variant", "year", "month"], how="left")
    num = [c for c in out.columns if c not in ("region", "variant", "year", "month")]
    out[num] = out[num].fillna(0)
    out["coverage"] = [
        month_fraction(y, m, dt.date(2000, 11, 1), today) for y, m in zip(out["year"], out["month"])
    ]
    return out


# ─── 8. Anomalies ───────────────────────────────────────────────────────────────

def add_anomalies(h: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    baselines: dict = {}
    z, pct, projected = [], [], []
    base = h[h["year"].isin(BASELINE_YEARS)]
    stats = base.groupby(["region", "variant", "month"])["harmonized"].agg(
        median="median", q25=lambda s: s.quantile(0.25), q75=lambda s: s.quantile(0.75), std="std", mean="mean",
    )
    for (region, variant, month), s in stats.iterrows():
        baselines.setdefault(region, {}).setdefault(variant, {})[int(month)] = {
            "median": round(s["median"], 1), "iqr": round(s["q75"] - s["q25"], 1),
            "q25": round(s["q25"], 1), "q75": round(s["q75"], 1),
            "std": round(s["std"], 1), "mean": round(s["mean"], 1),
        }
    for _, r in h.iterrows():
        b = baselines[r["region"]][r["variant"]][int(r["month"])]
        value = r["harmonized"] / r["coverage"] if 0 < r["coverage"] < 1 else r["harmonized"]
        spread = b["iqr"] if b["iqr"] > 0 else b["std"]
        z.append(round((value - b["median"]) / spread, 2) if spread and spread > 0 else None)
        pct.append(round((value - b["median"]) / b["median"] * 100, 1) if b["median"] > 0 else None)
        projected.append(round(value, 1))
    h = h.assign(z=z, pct=pct, projected=projected)
    return h, baselines


def goodness_of_fit(h_counts: pd.DataFrame, alpha: dict, coverage: dict) -> dict:
    """How well α·VIIRS reproduces MODIS on full overlap months (national, masked)."""
    t = h_counts.xs(("indonesia", "masked"), level=("region", "variant"))
    out = {}
    for s in VIIRS:
        lo, hi = coverage[s]
        mod, est = [], []
        for (y, mo), row in t.iterrows():
            if y >= 2026 or month_fraction(y, mo, lo, hi) < 1:
                continue
            m, v = row[("celldays", "MODIS")], row[("celldays", s)]
            if m >= MIN_OVERLAP_COUNT and v >= MIN_OVERLAP_COUNT:
                mod.append(m)
                est.append(alpha["indonesia"][s][mo][0] * v)
        mod, est = np.log1p(mod), np.log1p(est)
        ss_res = float(np.sum((mod - est) ** 2))
        ss_tot = float(np.sum((mod - mod.mean()) ** 2))
        out[s] = {
            "months": len(mod),
            "r2_log": round(1 - ss_res / ss_tot, 3) if ss_tot else None,
            "median_abs_pct_error": round(float(np.median(np.abs(np.expm1(est) - np.expm1(mod)) / np.expm1(mod))) * 100, 1),
        }
    return out


def validation_chart(h: pd.DataFrame, path: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    nat = h[(h["region"] == "indonesia") & (h["variant"] == "masked") & (h["year"] >= 2001)]
    yearly = nat.groupby("year").agg(
        raw=("raw_points", "sum"), modis=("modis_points", "sum"), harmonized=("harmonized", "sum"),
    )
    fig, ax = plt.subplots(figsize=(11, 5.2), dpi=130)
    fig.patch.set_facecolor("#07090b")
    ax.set_facecolor("#0b0b0b")
    ax.plot(yearly.index, yearly["raw"], color="#7d7d7d", lw=2, marker="o", ms=3, label="Raw sensor detections (MODIS + all VIIRS)")
    ax.plot(yearly.index, yearly["modis"], color="#3b82f6", lw=1.5, ls="--", label="MODIS detections only")
    ax.plot(yearly.index, yearly["harmonized"], color="#f9880f", lw=2.5, marker="o", ms=3, label="Artemis harmonized (MODIS-equivalent cell-days)")
    for x, txt in ((2012, "S-NPP VIIRS starts"), (2018, "NOAA-20 VIIRS starts")):
        ax.axvline(x, color="#ffffff", alpha=0.18, lw=1)
        ax.text(x + 0.15, ax.get_ylim()[1] * 0.92, txt, color="#e4e7ec", alpha=0.6, fontsize=8)
    ax.set_yscale("log")
    ax.set_title("Indonesia annual fire activity 2001–2026 · static heat masked (2026 partial)", color="#e4e7ec", loc="left", fontsize=11)
    ax.tick_params(colors="#a1a1a1")
    for s in ax.spines.values():
        s.set_color("#373737")
    ax.grid(color="#ffffff", alpha=0.06)
    leg = ax.legend(facecolor="#111111", edgecolor="#373737", labelcolor="#e4e7ec", fontsize=8, loc="lower left")
    leg.get_frame().set_alpha(0.9)
    fig.tight_layout()
    fig.savefig(path, facecolor=fig.get_facecolor())
    print(f"  chart → {path}", flush=True)


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    print("1. Loading raw CSVs", flush=True)
    df = load_all()
    print("2. Clipping to Indonesia + provinces", flush=True)
    df = assign_provinces(df)
    print("3. H3 gridding", flush=True)
    df = add_cells(df)
    print("4. Static heat mask", flush=True)
    df, persistent = static_mask(df)
    coverage = sensor_coverage(df)
    print("  coverage:", {k: f"{a}→{b}" for k, (a, b) in coverage.items()}, flush=True)

    print("5. Monthly counts", flush=True)
    table = monthly_counts(df)
    print("6. Calibration", flush=True)
    fit = fit_alpha(table, coverage, "celldays")
    frp_fit = fit_alpha(table, coverage, "frp")
    gof = goodness_of_fit(table, fit["final"], coverage)
    print("  national α (cell-days):", {
        s: [round(fit["final"]["indonesia"][s][m][0], 2) for m in range(1, 13)] for s in VIIRS
    }, flush=True)
    print("  fit:", gof, flush=True)

    print("7. Harmonized series + anomalies", flush=True)
    h = fill_missing_months(harmonize(table, fit["final"], frp_fit["final"], coverage))
    h, baselines = add_anomalies(h)

    df.to_parquet(WORK / "points.parquet", index=False)
    h.to_parquet(WORK / "monthly.parquet", index=False)
    persistent.to_parquet(WORK / "persistent.parquet", index=False)
    (WORK / "calibration.json").write_text(json.dumps({
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "unit": "fire cell-days (unique H3 res-8 cell × date per sensor)",
        "method": "median of monthly MODIS/VIIRS ratios per calendar month over full overlap months (masked data); province-specific when ≥6 overlap years with ≥30 cell-days in both sensors and within 0.5–2× the national value, else national",
        "coverage": {k: [str(a), str(b)] for k, (a, b) in coverage.items()},
        "alpha": {r: {s: {m: [round(v, 3), src] for m, (v, src) in ms.items()} for s, ms in d.items()} for r, d in fit["final"].items()},
        "frpAlpha": {r: {s: {m: [round(v, 3), src] for m, (v, src) in ms.items()} for s, ms in d.items()} for r, d in frp_fit["final"].items()},
        "pooled": {r: {s: fit["raw"][r][s]["pooled"] for s in VIIRS} for r in REGIONS},
        "goodnessOfFit": gof,
        "baselines": baselines,
        "staticCellYears": int(len(persistent)),
        "staticDetections": int(df["static"].sum()),
        "totalDetections": int(len(df)),
    }, indent=1, default=float))
    validation_chart(h, WORK / "validation_annual.png")
    print(f"Done → {WORK}", flush=True)


if __name__ == "__main__":
    import sys as _sys
    _sys.stdout.reconfigure(encoding="utf-8")
    main()
