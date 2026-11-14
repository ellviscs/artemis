// EUDR post-2020 zero-burn screen and indicative burn-frequency statistics for a
// plot polygon, computed from the harmonized NASA FIRMS archive.
//
// Two evidence levels:
//  - cell level: national H3 res-7 hex files (~5 km² cells, 2000–2026, static heat
//    masked) for every cell that overlaps the plot. Available everywhere in Indonesia.
//  - detection level: 375 m / 1 km detections inside the exact polygon, for the five
//    provinces with detection archives, from 2021 (the EUDR window) onward.
import { cellToBoundary, latLngToCell, polygonToCells } from 'h3-js';

import { fetchArchiveHotspots, fetchHexYear } from '@/data/historyApi';
import { INDONESIA_PROVINCES } from '@/data/regions';
import { aoiAreaKm2, aoiContains, archiveCell, haversineKm, type LatLng } from '@/lib/aoi';

export const EUDR_CUTOFF = '2020-12-31';
const FIRST_POST_YEAR = 2021;
const ARCHIVE_YEARS = Array.from({ length: 2026 - 2000 + 1 }, (_, i) => 2000 + i);
/** Complete years used for burn frequency (2000 starts in November; 2026 is partial). */
const FULL_YEARS = ARCHIVE_YEARS.filter((y) => y >= 2001 && y <= 2025);
const INDONESIA_BBOX = { minLat: -11.5, maxLat: 6.5, minLng: 94.5, maxLng: 141.5 };
export const MAX_AREA_KM2 = 10_000;

export interface AuditPlot {
  name: string;
  source: 'demo' | 'upload' | 'dashboard';
  ring: LatLng[];
  note?: string;
}

export interface AuditDetection {
  date: string;
  time: string;
  lat: number;
  lng: number;
  sensor: string;
  satellite: string;
  confidence: number;
  frp: number;
}

export interface AuditResult {
  plot: AuditPlot;
  areaKm2: number;
  cells: string[];
  /** Harmonized fire cell-days in overlapping cells, per year and month. */
  monthly: { year: number; month: number; value: number }[];
  yearly: { year: number; value: number }[];
  post: {
    /** Cell-level fire cell-days on or after 2021-01-01. */
    cellDays: number;
    /** Exact in-polygon detections since 2021, or null where no detection archive exists. */
    detections: AuditDetection[] | null;
    province: { id: string; name: string } | null;
  };
  verdict: 'PASS' | 'FLAGGED';
  verdictBasis: 'detection' | 'cell';
  insurance: {
    burnYears: number;
    years: number;
    rate: number;
    ci: [number, number];
    meanReturnYears: number | null;
    lastBurnYear: number | null;
    tier: 'Low' | 'Moderate' | 'High';
  };
}

const PLATFORM: Record<string, string> = { N: 'S-NPP', N20: 'NOAA-20', N21: 'NOAA-21', T: 'Terra', A: 'Aqua' };

/** Wilson score interval for a binomial proportion. */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Cells whose centre is inside the plot, plus every cell the boundary passes through. */
export function overlappingCells(ring: LatLng[]): string[] {
  const cells = new Set<string>(polygonToCells(ring, 7));
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % ring.length]];
    const steps = Math.max(1, Math.ceil(haversineKm(a[0], a[1], b[0], b[1]) / 0.3));
    for (let s = 0; s <= steps; s++) {
      const lat = a[0] + ((b[0] - a[0]) * s) / steps;
      const lng = a[1] + ((b[1] - a[1]) * s) / steps;
      cells.add(latLngToCell(lat, lng, 7));
      cells.add(archiveCell(lat, lng)); // pipeline keys cells by the res-8 parent
    }
  }
  return [...cells];
}

export function cellOutline(cell: string): LatLng[] {
  return cellToBoundary(cell) as LatLng[];
}

function provinceFor(ring: LatLng[]): { id: string; name: string } | null {
  const lat = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lng = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const p = INDONESIA_PROVINCES.find((r) => lat >= r.bbox.minLat && lat <= r.bbox.maxLat && lng >= r.bbox.minLng && lng <= r.bbox.maxLng);
  return p ? { id: p.id, name: p.name } : null;
}

/** Problems that stop an audit from running, or null. */
export function validatePlot(ring: LatLng[]): string | null {
  if (ring.length < 3) return 'A plot needs at least three vertices.';
  if (!ring.every(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))) return 'Some coordinates are not numbers.';
  const outside = ring.some(([lat, lng]) => lat < INDONESIA_BBOX.minLat || lat > INDONESIA_BBOX.maxLat || lng < INDONESIA_BBOX.minLng || lng > INDONESIA_BBOX.maxLng);
  if (outside) return 'The plot is outside Indonesia. The archive covers Indonesia only. Check that coordinates are latitude, longitude (GeoJSON uses longitude first).';
  const area = aoiAreaKm2({ kind: 'polygon', points: ring });
  if (area > MAX_AREA_KM2) return `The plot is ${Math.round(area).toLocaleString()} km². Audit plots must be under ${MAX_AREA_KM2.toLocaleString()} km²; split large concessions into parts.`;
  return null;
}

export async function runAudit(plot: AuditPlot, onProgress?: (done: number, total: number) => void): Promise<AuditResult> {
  const ring = plot.ring;
  const cells = overlappingCells(ring);
  const cellSet = new Set(cells);
  const sums = new Map<string, number>();
  let done = 0;
  const province = provinceFor(ring);
  const postYears = ARCHIVE_YEARS.filter((y) => y >= FIRST_POST_YEAR);
  const total = ARCHIVE_YEARS.length + (province ? postYears.length : 0);

  await Promise.all(
    ARCHIVE_YEARS.map(async (year) => {
      const hex = await fetchHexYear(year);
      const idx = new Set<number>();
      hex.cells.forEach((c, i) => cellSet.has(c) && idx.add(i));
      for (let i = 0; i < hex.value.length; i++) {
        if (idx.has(hex.cell[i])) {
          const key = `${year}-${hex.month[i]}`;
          sums.set(key, (sums.get(key) ?? 0) + hex.value[i]);
        }
      }
      onProgress?.(++done, total);
    }),
  );

  let detections: AuditDetection[] | null = null;
  if (province) {
    const aoi = { kind: 'polygon' as const, points: ring };
    const perYear = await Promise.all(
      postYears.map(async (year) => {
        const pts = await fetchArchiveHotspots(province.id, year);
        onProgress?.(++done, total);
        return pts
          .filter((p) => !p.static && p.date > EUDR_CUTOFF && aoiContains(aoi, p.lat, p.lon))
          .map((p) => ({
            date: p.date, time: p.time, lat: p.lat, lng: p.lon, sensor: p.sensor === 'MODIS' ? 'MODIS' : 'VIIRS',
            satellite: PLATFORM[p.satellite] ?? p.satellite, confidence: p.conf, frp: p.frp,
          }));
      }),
    );
    detections = perYear.flat().sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  }

  const now = new Date();
  const monthly: AuditResult['monthly'] = [];
  for (const year of ARCHIVE_YEARS) {
    for (let month = 1; month <= 12; month++) {
      if (year === 2000 && month < 11) continue;
      if (year === now.getFullYear() && month > now.getMonth() + 1) continue;
      monthly.push({ year, month, value: Math.round((sums.get(`${year}-${month}`) ?? 0) * 100) / 100 });
    }
  }
  const yearly = ARCHIVE_YEARS.map((year) => ({ year, value: monthly.filter((m) => m.year === year).reduce((s, m) => s + m.value, 0) }));
  const postCellDays = yearly.filter((y) => y.year >= FIRST_POST_YEAR).reduce((s, y) => s + y.value, 0);

  const verdictBasis = detections ? 'detection' : 'cell';
  const flagged = detections ? detections.length > 0 : postCellDays > 0;

  const burnYearList = FULL_YEARS.filter((y) => (yearly.find((r) => r.year === y)?.value ?? 0) > 0);
  const k = burnYearList.length;
  const n = FULL_YEARS.length;
  const rate = k / n;
  const gaps = burnYearList.slice(1).map((y, i) => y - burnYearList[i]);
  const allBurnYears = yearly.filter((y) => y.value > 0).map((y) => y.year);

  return {
    plot,
    areaKm2: aoiAreaKm2({ kind: 'polygon', points: ring }),
    cells,
    monthly,
    yearly,
    post: { cellDays: postCellDays, detections, province },
    verdict: flagged ? 'FLAGGED' : 'PASS',
    verdictBasis,
    insurance: {
      burnYears: k,
      years: n,
      rate,
      ci: wilson(k, n),
      meanReturnYears: gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null,
      lastBurnYear: allBurnYears.length ? allBurnYears[allBurnYears.length - 1] : null,
      tier: rate >= 0.3 ? 'High' : rate >= 0.1 ? 'Moderate' : 'Low',
    },
  };
}

// ─── Input parsing ─────────────────────────────────────────────────────────────

type Position = number[];

function largestRing(rings: Position[][]): Position[] | null {
  let best: Position[] | null = null;
  let bestArea = -1;
  for (const r of rings) {
    const ring = r.map(([lng, lat]) => [lat, lng] as LatLng);
    const a = aoiAreaKm2({ kind: 'polygon', points: ring });
    if (a > bestArea) {
      bestArea = a;
      best = r;
    }
  }
  return best;
}

/** Outer ring of the largest polygon in a GeoJSON document, as [lat, lng]. */
export function parseGeoJson(text: string): { ring: LatLng[]; name?: string; parts: number } {
  const doc = JSON.parse(text) as Record<string, unknown>;
  const outerRings: Position[][] = [];
  let name: string | undefined;
  const visit = (g: Record<string, unknown> | null | undefined, props?: Record<string, unknown>) => {
    if (!g) return;
    if (g.type === 'FeatureCollection') (g.features as Record<string, unknown>[]).forEach((f) => visit(f));
    else if (g.type === 'Feature') visit(g.geometry as Record<string, unknown>, g.properties as Record<string, unknown>);
    else if (g.type === 'Polygon') outerRings.push((g.coordinates as Position[][])[0]);
    else if (g.type === 'MultiPolygon') (g.coordinates as Position[][][]).forEach((p) => outerRings.push(p[0]));
    else if (g.type === 'GeometryCollection') (g.geometries as Record<string, unknown>[]).forEach((x) => visit(x));
    if (!name && props) {
      const n = props.name ?? props.Name ?? props.NAME ?? props.id;
      if (typeof n === 'string' || typeof n === 'number') name = String(n);
    }
  };
  visit(doc);
  const outer = largestRing(outerRings);
  if (!outer) throw new Error('No Polygon or MultiPolygon found in the GeoJSON.');
  const ring = outer.map(([lng, lat]) => [lat, lng] as LatLng);
  if (ring.length > 3 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
  return { ring, name, parts: outerRings.length };
}

/** CSV with latitude and longitude columns (any order), one vertex per row. */
export function parseCsvRing(text: string): LatLng[] {
  const rows = text.trim().split(/\r*\n/).map((l) => l.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, '')));
  const header = rows[0].map((h) => h.toLowerCase());
  const latIdx = header.findIndex((h) => h === 'lat' || h === 'latitude' || h === 'y');
  const lngIdx = header.findIndex((h) => h === 'lon' || h === 'lng' || h === 'long' || h === 'longitude' || h === 'x');
  if (latIdx < 0 || lngIdx < 0) throw new Error('The CSV needs a header with latitude and longitude columns (lat, lon).');
  const ring = rows.slice(1).filter((r) => r.length > Math.max(latIdx, lngIdx)).map((r) => [Number(r[latIdx]), Number(r[lngIdx])] as LatLng);
  if (ring.length > 3 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
  return ring;
}

// ─── Demo plots (real coordinates chosen from the processed archive) ───────────

const square = (lat: number, lng: number, h: number): LatLng[] => [
  [lat - h, lng - h], [lat - h, lng + h], [lat + h, lng + h], [lat + h, lng - h],
];

export const DEMO_PLOTS: (AuditPlot & { expect: string })[] = [
  {
    name: 'Demo plot A · Gayo Highlands smallholder plot',
    source: 'demo',
    ring: square(4.63, 96.86, 0.006),
    note: 'Fictional cooperative name; real coordinates near Takengon, Central Aceh (~1.3 × 1.3 km). Its archive cell burned once, in 2018; nothing since.',
    expect: 'EUDR pass',
  },
  {
    name: 'Demo plot B · Kalimantan concession plot 4',
    source: 'demo',
    ring: [[-3.222, 112.664], [-3.222, 112.69], [-3.205, 112.69], [-3.205, 112.664]],
    note: 'Fictional plot name; real coordinates in Central Kalimantan (~1.9 × 2.9 km). Burned in 2015, 2019, 2023 and 2026.',
    expect: 'Recurring burns',
  },
];
