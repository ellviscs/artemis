// Client-side CSV exports: detection-level hotspots and monthly analytics for the
// current area, period and static-heat mask setting.
import { fetchArchiveHotspots, fetchHistoryMeta, type ArchiveHotspot } from '@/data/historyApi';
import { aoiBounds, aoiContains, aoiLabel, type Aoi } from '@/lib/aoi';
import { cellKey, type CalendarData } from '@/lib/calendarData';
import { ymKey, ymString, type YearMonth } from '@/state/yearMonth';

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: unknown[][]): string {
  return [columns.join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n') + '\n';
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSlug(aoi: Aoi, start: YearMonth, end: YearMonth): string {
  const area = aoi.kind === 'region' ? aoi.regionId : aoi.kind === 'point' ? `point-${aoi.lat.toFixed(2)}_${aoi.lng.toFixed(2)}_${aoi.radiusKm}km` : 'polygon';
  return `artemis_${area}_${ymString(start)}_${ymString(end)}`;
}

const inRange = (ym: YearMonth, start: YearMonth, end: YearMonth) => ymKey(ym) >= ymKey(start) && ymKey(ym) <= ymKey(end);

export function buildMonthlyCsv(data: CalendarData, start: YearMonth, end: YearMonth, aoi: Aoi, maskStatic: boolean): string {
  const columns = [
    'area', 'year', 'month', 'month_coverage', 'harmonized_fire_cell_days', 'projected_full_month',
    'baseline_median_2001_2025', 'baseline_q25', 'baseline_q75', 'anomaly_z_iqr', 'anomaly_pct_vs_median',
    'raw_detections_all_sensors', 'modis_detections', 'viirs_detections',
    'modis_cell_days', 'viirs_snpp_cell_days', 'viirs_noaa20_cell_days', 'frp_harmonized_mw', 'static_heat_masked',
  ];
  const rows: unknown[][] = [];
  const area = aoiLabel(aoi);
  for (const year of data.years) {
    for (let month = 1; month <= 12; month++) {
      const c = data.cells.get(cellKey(year, month));
      if (!c || !inRange({ year, month }, start, end)) continue;
      const b = data.baseline[month];
      const r = c.record;
      rows.push([
        area, year, month, c.coverage.toFixed(3), c.harmonized.toFixed(1), c.projected.toFixed(1),
        b?.median.toFixed(1), b?.q25.toFixed(1), b?.q75.toFixed(1),
        c.z?.toFixed(2) ?? '', c.pct?.toFixed(1) ?? '',
        r?.rawPoints ?? '', r?.modisPoints ?? '', r?.viirsPoints ?? '',
        r?.modisCellDays ?? '', r?.snppCellDays ?? '', r?.noaa20CellDays ?? '', r?.frpHarmonized ?? '',
        data.maskFixed || maskStatic ? 'yes' : 'no',
      ]);
    }
  }
  return toCsv(columns, rows);
}

export interface HotspotExportResult {
  csv: string;
  count: number;
  /** Why detection-level data is unavailable for this AOI, if it is. */
  unavailable?: string;
}

/** Provinces with shipped point files whose bounds intersect the AOI. */
async function pointRegionsFor(aoi: Aoi): Promise<string[]> {
  const meta = await fetchHistoryMeta();
  const withPoints = Object.entries(meta.regions).filter(([, r]) => r.points && r.bounds);
  if (aoi.kind === 'region') return withPoints.some(([id]) => id === aoi.regionId) ? [aoi.regionId] : [];
  const b = aoiBounds(aoi);
  return withPoints
    .filter(([, r]) => {
      const [minLat, minLng, maxLat, maxLng] = r.bounds!;
      return b.minLat <= maxLat && b.maxLat >= minLat && b.minLng <= maxLng && b.maxLng >= minLng;
    })
    .map(([id]) => id);
}

export async function loadAoiHotspots(
  aoi: Aoi,
  start: YearMonth,
  end: YearMonth,
  maskStatic: boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<{ hotspots: ArchiveHotspot[]; regions: string[] }> {
  const regions = await pointRegionsFor(aoi);
  const years = Array.from({ length: end.year - start.year + 1 }, (_, i) => start.year + i);
  const jobs = regions.flatMap((region) => years.map((year) => ({ region, year })));
  let done = 0;
  const parts = await Promise.all(jobs.map(async ({ region, year }) => {
    const rows = await fetchArchiveHotspots(region, year);
    onProgress?.(++done, jobs.length);
    return rows.filter((h) => {
      const [y, m] = h.date.split('-').map(Number);
      if (!inRange({ year: y, month: m }, start, end)) return false;
      if (maskStatic && h.static) return false;
      return aoi.kind === 'region' || aoiContains(aoi, h.lat, h.lon);
    });
  }));
  const hotspots = parts.flat().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { hotspots, regions };
}

export async function buildHotspotCsv(
  aoi: Aoi,
  start: YearMonth,
  end: YearMonth,
  maskStatic: boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<HotspotExportResult> {
  const { hotspots, regions } = await loadAoiHotspots(aoi, start, end, maskStatic, onProgress);
  if (!regions.length) {
    return {
      csv: '',
      count: 0,
      unavailable:
        'Detection-level files ship for the five fire provinces (Riau, Jambi, South Sumatra, West Kalimantan, Central Kalimantan). ' +
        'Choose one of them or draw an area inside them; the monthly analytics CSV covers all of Indonesia.',
    };
  }
  const columns = [
    'date', 'time_utc', 'latitude', 'longitude', 'sensor', 'satellite', 'confidence', 'frp_mw',
    'brightness_k', 'scan_km', 'track_km', 'day_night', 'static_heat',
  ];
  const rows = hotspots.map((h) => [
    h.date, `${h.time.slice(0, 2)}:${h.time.slice(2)}`, h.lat, h.lon, h.sensor, h.satellite, h.conf, h.frp,
    h.bright, h.scan, h.track, h.dn, h.static ? 'yes' : 'no',
  ]);
  return { csv: toCsv(columns, rows), count: hotspots.length };
}

