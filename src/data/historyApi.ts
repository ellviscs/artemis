// Typed loaders for the harmonized FIRMS archive produced by pipeline/export.py
// and served statically from /data. All responses are cached in memory.

export type CalendarVariant = 'masked' | 'unmasked';
export type ViirsPlatform = 'SNPP' | 'NOAA20';

export interface MonthRecord {
  year: number;
  month: number; // 1–12
  /** Fraction of the calendar month covered by data (current month < 1). */
  coverage: number;
  /** Raw detections summed across MODIS + every VIIRS platform (shows the 2012 jump). */
  rawPoints: number;
  modisPoints: number;
  viirsPoints: number;
  modisCellDays: number;
  snppCellDays: number;
  noaa20CellDays: number;
  /** MODIS-equivalent fire cell-days (Artemis harmonized series). */
  harmonized: number;
  frpHarmonized: number;
  /** Harmonized value scaled to a full month when coverage < 1. */
  projected: number;
  /** (projected − median) / IQR for this calendar month; null when the baseline has no spread. */
  z: number | null;
  /** % difference from the calendar-month median. */
  pct: number | null;
  /** Number of sensors contributing to the harmonized estimate. */
  sources: number;
}

export interface MonthBaseline {
  median: number;
  iqr: number;
  q25: number;
  q75: number;
  std: number;
  mean: number;
}

export interface RegionCalendar {
  region: string;
  /** VIIRS → MODIS calibration α per platform and month: [alpha, source]. */
  alpha: Record<ViirsPlatform, Record<string, [number, string]>>;
  variants: Record<CalendarVariant, { baseline: Record<string, MonthBaseline>; months: MonthRecord[] }>;
}

export interface HistoryMeta {
  generatedAt: string;
  range: { start: string; end: string; years: [number, number] };
  sensors: Record<'MODIS' | ViirsPlatform, { label: string; resolution: string; coverage: [string, string]; note?: string }>;
  unit: string;
  harmonization: {
    method: string;
    formula: string;
    pooledAlpha: Record<string, Record<ViirsPlatform, number | null>>;
    goodnessOfFit: Record<ViirsPlatform, { months: number; r2_log: number | null; median_abs_pct_error: number }>;
  };
  anomaly: { baselineYears: [number, number]; formula: string };
  staticMask: { rule: string; sources: number; detections: number };
  totals: { detections: number };
  regions: Record<string, { province: string | null; bounds: [number, number, number, number] | null; points: boolean }>;
  attribution: string[];
}

export interface HexYear {
  year: number;
  resolution: number;
  /** H3 cell ids (resolution 7). */
  cells: string[];
  /** Parallel arrays: index into `cells`, month (1–12), harmonized value. */
  cell: number[];
  month: number[];
  value: number[];
}

export interface StaticSource {
  cell: string;
  lat: number;
  lon: number;
  reason: 'persistent' | 'volcano' | 'static-land' | 'offshore' | 'firms-type';
  years?: number[];
  maxDays?: number;
  detections?: number;
}

export interface ArchiveHotspot {
  date: string;
  time: string;
  lat: number;
  lon: number;
  sensor: 'MODIS' | ViirsPlatform;
  satellite: string;
  conf: number;
  frp: number;
  bright: number;
  scan: number;
  track: number;
  dn: 'D' | 'N' | '';
  static: boolean;
}

const BASE = '/data';
const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let hit = cache.get(key) as Promise<T> | undefined;
  if (!hit) {
    hit = load().catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, hit);
  }
  return hit;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}/${path}`);
  if (!response.ok) throw new Error(`Archive file ${path} is unavailable (${response.status}).`);
  return response.json() as Promise<T>;
}

export function fetchHistoryMeta(): Promise<HistoryMeta> {
  return cached('meta', () => getJson<HistoryMeta>('meta.json'));
}

interface RawCalendar {
  region: string;
  columns: string[];
  alpha: RegionCalendar['alpha'];
  variants: Record<CalendarVariant, { baseline: Record<string, MonthBaseline>; rows: (number | null)[][] }>;
}

export function fetchRegionCalendar(regionId: string): Promise<RegionCalendar> {
  return cached(`calendar:${regionId}`, async () => {
    const raw = await getJson<RawCalendar>(`calendar/${regionId}.json`);
    const toRecord = (row: (number | null)[]): MonthRecord => {
      const entry = Object.fromEntries(raw.columns.map((column, i) => [column, row[i]]));
      return entry as unknown as MonthRecord;
    };
    const variants = Object.fromEntries(
      (Object.keys(raw.variants) as CalendarVariant[]).map((variant) => [
        variant,
        { baseline: raw.variants[variant].baseline, months: raw.variants[variant].rows.map(toRecord) },
      ]),
    ) as RegionCalendar['variants'];
    return { region: raw.region, alpha: raw.alpha, variants };
  });
}

export function fetchHexYear(year: number): Promise<HexYear> {
  return cached(`hex:${year}`, () => getJson<HexYear>(`hex/${year}.json`));
}

export function fetchStaticSources(): Promise<{ count: number; sources: StaticSource[] }> {
  return cached('static', () => getJson<{ count: number; sources: StaticSource[] }>('static.json'));
}

async function gunzipText(response: Response): Promise<string> {
  // Files are stored as .gz. Some servers add Content-Encoding and the browser has
  // already inflated the body, so only decompress when the gzip magic bytes are present.
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

export function fetchArchiveHotspots(regionId: string, year: number): Promise<ArchiveHotspot[]> {
  return cached(`points:${regionId}:${year}`, async () => {
    const response = await fetch(`${BASE}/points/${regionId}/${year}.csv.gz`);
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`Hotspot archive for ${regionId} ${year} is unavailable (${response.status}).`);
    const text = await gunzipText(response);
    // Tolerate any CR/LF mix (older exports ended lines with "\r\r\n").
    const lines = text.trim().split(/\r*\n/);
    const header = lines[0]?.split(',') ?? [];
    const at = (name: string) => header.indexOf(name);
    const idx = {
      date: at('date'), time: at('time'), lat: at('lat'), lon: at('lon'), sensor: at('sensor'),
      satellite: at('satellite'), conf: at('conf'), frp: at('frp'), bright: at('bright'),
      scan: at('scan'), track: at('track'), dn: at('dn'), static: at('static'),
    };
    return lines.slice(1).map((line) => {
      const v = line.split(',');
      return {
        date: v[idx.date],
        time: v[idx.time],
        lat: Number(v[idx.lat]),
        lon: Number(v[idx.lon]),
        sensor: v[idx.sensor] as ArchiveHotspot['sensor'],
        satellite: v[idx.satellite],
        conf: Number(v[idx.conf]),
        frp: Number(v[idx.frp]),
        bright: Number(v[idx.bright]),
        scan: Number(v[idx.scan]),
        track: Number(v[idx.track]),
        dn: (v[idx.dn] as ArchiveHotspot['dn']) || '',
        static: v[idx.static] === '1',
      };
    });
  });
}

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

// ─── Forensic signature (pipeline/forensics.py) ─────────────────────────────

export interface ForensicCell {
  cell: string;
  /** Rule-based Anthropogenic Thermal Signature score, 0–100. */
  score: number;
  /** Share of Indonesian fire cells with a lower score (0–100). */
  percentile: number;
  offSeason: number;
  /** null when the cell never had a day with ≥5 VIIRS detections. */
  geometry: number | null;
  /** Afternoon-overpass share, percentile within the province (0–1). */
  timing: number;
  recurrence: number;
  activeYears: number;
  cycleShare: number;
  nightShare: number;
  afternoonShare: number;
  lastActive: string;
  maxFrp: number;
  province: string;
  /** Fire cell-days per year, aligned with `years`. */
  yearly: number[];
  years: number[];
}

export interface ForensicIndex {
  weights: Record<'offSeason' | 'geometry' | 'timing' | 'recurrence', number>;
  tileResolution: number;
  cellResolution: number;
  minActiveDays: number;
  method: string;
  scoreQuantiles: Record<string, number>;
}

interface ForensicTile {
  columns: string[];
  years: number[];
  cells: Record<string, unknown[]>;
}

export function fetchForensicIndex(): Promise<ForensicIndex> {
  return cached('forensics:index', () => getJson<ForensicIndex>('forensics/index.json'));
}

/** Forensic record for an H3 res-7 cell, or null if the cell has too little history. */
export async function fetchForensicCell(cell: string): Promise<ForensicCell | null> {
  const { cellToParent } = await import('h3-js');
  const tileId = cellToParent(cell, 3);
  const tile = await cached(`forensics:${tileId}`, async () => {
    const response = await fetch(`${BASE}/forensics/${tileId}.json`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Forensic tile unavailable (${response.status}).`);
    return response.json() as Promise<ForensicTile>;
  });
  const row = tile?.cells[cell];
  if (!tile || !row) return null;
  const entry = Object.fromEntries(tile.columns.map((c, i) => [c, row[i]]));
  return { ...(entry as Omit<ForensicCell, 'cell' | 'years'>), cell, years: tile.years };
}
