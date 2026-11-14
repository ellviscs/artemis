// Builds the Year × Month burning calendar from the harmonized archive, either for an
// exported region (full detail) or for any drawn / point AOI (aggregated from H3 hexes).
import { cellToLatLng } from 'h3-js';

import {
  fetchHexYear,
  fetchRegionCalendar,
  type CalendarVariant,
  type MonthBaseline,
  type MonthRecord,
} from '@/data/historyApi';
import { aoiBounds, aoiContains, type Aoi } from '@/lib/aoi';

export type CalendarMode = 'harmonized' | 'raw';

export interface CalendarCell {
  year: number;
  month: number;
  /** Value shown for the active mode (harmonized cell-days or raw detections). */
  value: number;
  harmonized: number;
  /** Full-month projection for the current partial month. */
  projected: number;
  coverage: number;
  z: number | null;
  pct: number | null;
  record?: MonthRecord;
}

export interface CalendarData {
  source: 'region' | 'aoi';
  regionId?: string;
  supportsRaw: boolean;
  /** Custom AOIs only use the masked hex grid. */
  maskFixed: boolean;
  cells: Map<string, CalendarCell>;
  baseline: Record<number, MonthBaseline>;
  years: number[];
}

/** Regions with exported archive files. */
export const ARCHIVE_REGIONS = new Set([
  'indonesia', 'id-riau', 'id-jambi', 'id-south-sumatra', 'id-west-kalimantan', 'id-central-kalimantan',
]);

export const cellKey = (year: number, month: number) => `${year}-${month}`;

const BASELINE_YEARS: [number, number] = [2001, 2025];
const ARCHIVE_YEARS = Array.from({ length: 2026 - 2000 + 1 }, (_, i) => 2000 + i);

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function computeBaseline(cells: Map<string, CalendarCell>): Record<number, MonthBaseline> {
  const out: Record<number, MonthBaseline> = {};
  for (let month = 1; month <= 12; month++) {
    const values: number[] = [];
    for (let y = BASELINE_YEARS[0]; y <= BASELINE_YEARS[1]; y++) values.push(cells.get(cellKey(y, month))?.harmonized ?? 0);
    values.sort((a, b) => a - b);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(values.length - 1, 1));
    const q25 = quantile(values, 0.25);
    const q75 = quantile(values, 0.75);
    out[month] = { median: quantile(values, 0.5), q25, q75, iqr: q75 - q25, std, mean };
  }
  return out;
}

function scoreAgainst(baseline: MonthBaseline, value: number): { z: number | null; pct: number | null } {
  const spread = baseline.iqr > 0 ? baseline.iqr : baseline.std;
  return {
    z: spread > 0 ? (value - baseline.median) / spread : null,
    pct: baseline.median > 0 ? ((value - baseline.median) / baseline.median) * 100 : null,
  };
}

export async function loadRegionCalendar(
  regionId: string,
  variant: CalendarVariant,
  mode: CalendarMode,
): Promise<CalendarData> {
  const cal = await fetchRegionCalendar(regionId);
  const v = cal.variants[variant];
  const cells = new Map<string, CalendarCell>();
  for (const r of v.months) {
    cells.set(cellKey(r.year, r.month), {
      year: r.year,
      month: r.month,
      value: mode === 'raw' ? r.rawPoints : r.harmonized,
      harmonized: r.harmonized,
      projected: r.projected,
      coverage: r.coverage,
      z: r.z,
      pct: r.pct,
      record: r,
    });
  }
  const baseline = Object.fromEntries(Object.entries(v.baseline).map(([m, b]) => [Number(m), b]));
  return {
    source: 'region', regionId, supportsRaw: true, maskFixed: false, cells, baseline,
    years: [...new Set(v.months.map((r) => r.year))].sort((a, b) => a - b),
  };
}

const hexCenterCache = new Map<string, [number, number]>();

function hexCenter(cell: string): [number, number] {
  let c = hexCenterCache.get(cell);
  if (!c) {
    c = cellToLatLng(cell) as [number, number];
    hexCenterCache.set(cell, c);
  }
  return c;
}

/** Aggregate harmonized hex values whose cell centre falls inside the AOI. */
export async function loadAoiCalendar(aoi: Aoi, onProgress?: (done: number, total: number) => void): Promise<CalendarData> {
  const b = aoiBounds(aoi);
  const cells = new Map<string, CalendarCell>();
  let done = 0;
  const now = new Date();
  const currentKey = cellKey(now.getFullYear(), now.getMonth() + 1);
  const elapsed = now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  await Promise.all(ARCHIVE_YEARS.map(async (year) => {
    const hex = await fetchHexYear(year).catch(() => null);
    const sums = new Array(13).fill(0);
    if (hex) {
      const inside = hex.cells.map((id) => {
        const [lat, lng] = hexCenter(id);
        return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng && aoiContains(aoi, lat, lng);
      });
      for (let i = 0; i < hex.value.length; i++) {
        if (inside[hex.cell[i]]) sums[hex.month[i]] += hex.value[i];
      }
    }
    for (let month = 1; month <= 12; month++) {
      if (year === 2000 && month < 11) continue;
      if (year === now.getFullYear() && month > now.getMonth() + 1) continue;
      const key = cellKey(year, month);
      const coverage = key === currentKey ? elapsed : 1;
      cells.set(key, {
        year, month, value: sums[month], harmonized: sums[month],
        projected: coverage > 0 ? sums[month] / coverage : sums[month], coverage, z: null, pct: null,
      });
    }
    onProgress?.(++done, ARCHIVE_YEARS.length);
  }));

  const baseline = computeBaseline(cells);
  for (const cell of cells.values()) Object.assign(cell, scoreAgainst(baseline[cell.month], cell.projected));
  return { source: 'aoi', supportsRaw: false, maskFixed: true, cells, baseline, years: ARCHIVE_YEARS };
}

/** Plain-language reading of an anomaly Z-score (IQR units). */
export function describeAnomaly(z: number | null): { label: string; tone: 'clear' | 'advisory' | 'watch' | 'warning' | 'extreme' } {
  if (z === null) return { label: 'No baseline spread', tone: 'advisory' };
  if (z >= 3) return { label: 'Extreme · far above normal', tone: 'extreme' };
  if (z >= 1.5) return { label: 'Well above normal', tone: 'warning' };
  if (z >= 0.5) return { label: 'Above normal', tone: 'watch' };
  if (z > -0.5) return { label: 'Near normal', tone: 'clear' };
  return { label: 'Below normal', tone: 'clear' };
}
