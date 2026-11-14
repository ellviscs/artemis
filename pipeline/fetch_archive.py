"""Download the real NASA FIRMS hotspot archive for Indonesia.

Sources
- 2000-2025: FIRMS yearly country files (one CSV per sensor per year):
  https://firms.modaps.eosdis.nasa.gov/data/country/{sensor}/{year}/{sensor}_{year}_Indonesia.csv
    modis       MODIS C6.1 (Terra + Aqua), 2000-11 onwards
    viirs-snpp  VIIRS Suomi-NPP 375 m, 2012-01-20 onwards
    viirs-jpss1 VIIRS NOAA-20 375 m, 2018-04 onwards
- 2026 (not yet in yearly files): FIRMS Area API, Indonesia bounding box, 5-day windows,
  standard-processing (SP) products where available, near-real-time (NRT) after that.
  Area results are clipped to Indonesia later in harmonize.py with geoBoundaries polygons.
- Province boundaries: geoBoundaries gbOpen IDN ADM1 (CC BY 4.0).

Raw files go to ARTEMIS_RAW_DIR (default: %LOCALAPPDATA%/artemis-pipeline/raw), outside
OneDrive, because the archive is ~1 GB. Re-running resumes: finished files are skipped.

Usage: python -I pipeline/fetch_archive.py   (reads FIRMS_API_KEY from env or ../.env)
"""

from __future__ import annotations

import datetime as dt
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = Path(os.environ.get("ARTEMIS_RAW_DIR") or Path(os.environ.get("LOCALAPPDATA", ROOT)) / "artemis-pipeline" / "raw")

COUNTRY_URL = "https://firms.modaps.eosdis.nasa.gov/data/country/{s}/{y}/{s}_{y}_Indonesia.csv"
AREA_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{product}/{bbox}/{days}/{date}"
AVAIL_URL = "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{key}/ALL"
BOUNDARY_URL = (
    "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IDN/ADM1/"
    "geoBoundaries-IDN-ADM1_simplified.geojson"
)
INDONESIA_BBOX = "94.5,-11.5,141.5,6.5"

YEARLY = {
    "modis": range(2000, 2026),
    "viirs-snpp": range(2012, 2026),
    "viirs-jpss1": range(2018, 2026),
}
# 2026 via the Area API: (product, folder) in priority order; SP first, NRT fills the rest.
API_2026 = {
    "modis": ["MODIS_SP", "MODIS_NRT"],
    "viirs-snpp": ["VIIRS_SNPP_SP", "VIIRS_SNPP_NRT"],
    "viirs-jpss1": ["VIIRS_NOAA20_SP", "VIIRS_NOAA20_NRT"],
}


def read_key() -> str:
    key = os.environ.get("FIRMS_API_KEY")
    if not key:
        env = ROOT.parent / ".env"
        if env.exists():
            for line in env.read_text().splitlines():
                if line.startswith("FIRMS_API_KEY="):
                    key = line.split("=", 1)[1].strip()
    if not key:
        sys.exit("FIRMS_API_KEY not set (env or Artemis-master/.env).")
    return key


def fetch(url: str, dest: Path, retries: int = 4) -> bool:
    """Download url to dest atomically. Returns False on 404."""
    tmp = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=300) as r, open(tmp, "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            tmp.replace(dest)
            return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            err = e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            err = e
        wait = 5 * (attempt + 1)
        print(f"   retry {attempt + 1} in {wait}s: {err}", flush=True)
        time.sleep(wait)
    raise RuntimeError(f"failed after {retries} tries: {url.split('/api/')[0]}")


def availability(key: str) -> dict[str, tuple[dt.date, dt.date]]:
    text = urllib.request.urlopen(AVAIL_URL.format(key=key), timeout=60).read().decode()
    out = {}
    for line in text.strip().splitlines()[1:]:
        pid, lo, hi = line.split(",")
        out[pid] = (dt.date.fromisoformat(lo), dt.date.fromisoformat(hi))
    return out


def main() -> None:
    key = read_key()
    RAW.mkdir(parents=True, exist_ok=True)
    print(f"Raw directory: {RAW}", flush=True)

    boundary = RAW / "idn_adm1.geojson"
    if not boundary.exists():
        print("Province boundaries (geoBoundaries IDN ADM1)", flush=True)
        fetch(BOUNDARY_URL, boundary)

    for sensor, years in YEARLY.items():
        for year in years:
            dest = RAW / sensor / f"{year}.csv"
            if dest.exists():
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            ok = fetch(COUNTRY_URL.format(s=sensor, y=year), dest)
            size = dest.stat().st_size / 1e6 if ok else 0
            print(f"{sensor} {year}: {'%.1f MB' % size if ok else 'not available'}", flush=True)

    avail = availability(key)
    today = dt.date.today()
    start_2026 = dt.date(2026, 1, 1)
    for sensor, products in API_2026.items():
        covered_until = start_2026 - dt.timedelta(days=1)
        for product in products:
            if product not in avail:
                continue
            lo, hi = avail[product]
            window_start = max(covered_until + dt.timedelta(days=1), lo, start_2026)
            window_end = min(hi, today)
            day = window_start
            n = 0
            while day <= window_end:
                days = min(5, (window_end - day).days + 1)
                dest = RAW / sensor / "2026" / f"{product}_{day.isoformat()}_{days}.csv"
                if not dest.exists():
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    url = AREA_URL.format(key=key, product=product, bbox=INDONESIA_BBOX, days=days, date=day.isoformat())
                    fetch(url, dest)
                    n += 1
                    time.sleep(0.3)
                day += dt.timedelta(days=days)
            if window_end >= window_start:
                covered_until = window_end
                print(f"{sensor} 2026 {product}: {window_start} → {window_end} ({n} new requests)", flush=True)

    total = sum(p.stat().st_size for p in RAW.rglob("*.csv")) / 1e6
    print(f"Done. {total:.0f} MB of CSV in {RAW}", flush=True)


if __name__ == "__main__":
    import sys as _sys
    _sys.stdout.reconfigure(encoding="utf-8")
    main()
