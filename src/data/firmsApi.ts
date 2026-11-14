import type { DailyFireSummary, EarlyWarning, FireHotspot, Region } from '@/types';

// Requests go through the server-side proxy (/api/firms), which holds the MAP_KEY.
const FIRMS_BASE_URL = '/api/firms';
// FIRMS acq_date / acq_time are UTC. "Live" means a rolling 24 hours ending now, picked by
// each detection's UTC time, so no overpass is lost to time zones (Sumatra's ~01:30 WIB
// night pass still carries the previous UTC date). Two UTC days starting the day before
// (now - 24 h) always contain that window; detections earlier in the request (up to 24 h
// more) are the "previous" window used for persistence checks.
const FIRMS_DAY_RANGE = 2;
const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const LIVE_CACHE_TTL_MS = 30 * 60 * 1000;
const LIVE_CACHE_PREFIX = 'artemis-firms-live-v3:';
let inFlightRequest: Promise<LiveFireData> | null = null;

export interface LiveFireData {
  /** Visitor's local date when fetched (labels and cache key). */
  date: string;
  /** The live window: detections acquired in [windowStart, windowEnd] (UTC ISO). */
  windowStart: string;
  windowEnd: string;
  modisHotspots: FireHotspot[];
  viirsHotspots: FireHotspot[];
  harmonizedHotspots: FireHotspot[];
  /** Detections from before the live window (up to 24 h earlier), used for persistence checks. */
  previousDayHotspots?: FireHotspot[];
  fetchedAt: string;
}

interface CachedLiveFireData {
  savedAt: number;
  data: LiveFireData;
}

function readCachedLiveData(date: string): LiveFireData | null {
  if (typeof window === 'undefined') return null;

  let cached: CachedLiveFireData;
  try {
    const raw = window.sessionStorage.getItem(`${LIVE_CACHE_PREFIX}${date}`);
    if (!raw) return null;
    cached = JSON.parse(raw) as CachedLiveFireData;
  } catch {
    return null;
  }
  if (!Number.isFinite(cached.savedAt) || Date.now() - cached.savedAt > LIVE_CACHE_TTL_MS) {
    window.sessionStorage.removeItem(`${LIVE_CACHE_PREFIX}${date}`);
    return null;
  }
  return cached.data;
}

function writeCachedLiveData(data: LiveFireData): void {
  if (typeof window === 'undefined') return;
  const cached: CachedLiveFireData = { savedAt: Date.now(), data };
  try {
    // Worldwide detections are large: drop older live caches (any version) before writing,
    // and never let a full storage quota break the live feed.
    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith('artemis-firms-live-')) window.sessionStorage.removeItem(key);
    }
    window.sessionStorage.setItem(`${LIVE_CACHE_PREFIX}${data.date}`, JSON.stringify(cached));
  } catch {
    // Quota exceeded or storage blocked: keep the data in memory only.
  }
}

// FIRMS returns UTC days [DATE .. DATE + DAY_RANGE - 1]; starting on the UTC date of
// (now - 24 h) always covers the whole rolling window.
function getRangeStart(now: number): string {
  return new Date(now - LIVE_WINDOW_MS).toISOString().slice(0, 10);
}

/** UTC time of a FIRMS row from acq_date (YYYY-MM-DD) and acq_time (HHMM). */
function acquiredAt(date: string, time: string): number {
  const t = time.padStart(4, '0');
  return Date.parse(`${date}T${t.slice(0, 2)}:${t.slice(2, 4)}:00Z`);
}

function getRequestedDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseConfidence(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'h') return 90;
  if (normalized === 'n') return 60;
  if (normalized === 'l') return 30;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
}

const SATELLITE_NAMES: Record<string, string> = {
  T: 'Terra',
  A: 'Aqua',
  N: 'Suomi-NPP',
  N20: 'NOAA-20',
  1: 'NOAA-20',
  N21: 'NOAA-21',
  2: 'NOAA-21',
  Terra: 'Terra',
  Aqua: 'Aqua',
};

function parseCsv(
  csv: string,
  source: FireHotspot['source'],
  fallbackSatellite: string,
): (FireHotspot & { at: number })[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',');
  const index = new Map(headers.map((header, position) => [header.trim(), position]));
  const required = ['latitude', 'longitude', 'acq_date', 'frp'];
  if (required.some((header) => !index.has(header))) {
    throw new Error(`NASA FIRMS ${source} response is missing required columns.`);
  }

  return lines.slice(1).flatMap((line, rowIndex) => {
    const values = line.split(',');
    const read = (header: string) => values[index.get(header) ?? -1]?.trim() ?? '';
    const lat = Number(read('latitude'));
    const lng = Number(read('longitude'));
    const frp = Number(read('frp'));
    const date = read('acq_date');
    const at = acquiredAt(date, read('acq_time'));
    if (!Number.isFinite(at) || ![lat, lng, frp].every(Number.isFinite)) return [];
    const satelliteCode = read('satellite');
    const dayNight = read('daynight').toUpperCase();

    return [{
      id: `firms-${fallbackSatellite.toLowerCase()}-${date}-${rowIndex}`,
      source,
      satellite: SATELLITE_NAMES[satelliteCode] ?? fallbackSatellite,
      dayNight: dayNight === 'D' || dayNight === 'N' ? dayNight : undefined,
      date,
      lat,
      lng,
      brightness: Number(read(source === 'MODIS' ? 'brightness' : 'bright_ti4')) || 0,
      confidence: parseConfidence(read('confidence')),
      frp,
      scan: Number(read('scan')) || 0,
      track: Number(read('track')) || 0,
      acqTime: read('acq_time').padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2'),
      at,
    }];
  });
}

function harmonizeLiveHotspots(modis: FireHotspot[], viirs: FireHotspot[]): FireHotspot[] {
  const grid = new Map<string, FireHotspot>();
  const cellSize = 0.009;
  for (const point of [...modis, ...viirs]) {
    const key = `${Math.floor(point.lat / cellSize)},${Math.floor(point.lng / cellSize)}`;
    const match = grid.get(key);
    if (match) {
      match.frp += point.frp;
      match.brightness = (match.brightness + point.brightness) / 2;
      match.confidence = Math.max(match.confidence, point.confidence);
    } else {
      grid.set(key, { ...point });
    }
  }
  return Array.from(grid.values());
}

export function isRegionMatch(hotspot: FireHotspot, region: Region): boolean {
  if (region.id === 'global') return true;
  const { minLat, maxLat, minLng, maxLng } = region.bbox;
  return hotspot.lat >= minLat && hotspot.lat <= maxLat &&
    hotspot.lng >= minLng && hotspot.lng <= maxLng;
}

export function createLiveDailySummary(
  data: LiveFireData,
  region: Region,
  contains: (hotspot: FireHotspot) => boolean = (hotspot) => isRegionMatch(hotspot, region),
): DailyFireSummary {
  const modis = data.modisHotspots.filter(contains);
  const viirs = data.viirsHotspots.filter(contains);
  const harmonized = data.harmonizedHotspots.filter(contains);
  const date = new Date(`${data.date}T00:00:00Z`);
  const totalFRP = harmonized.reduce((sum, hotspot) => sum + hotspot.frp, 0);
  const meanBrightness = harmonized.length
    ? harmonized.reduce((sum, hotspot) => sum + hotspot.brightness, 0) / harmonized.length : 0;
  const meanConfidence = harmonized.length
    ? harmonized.reduce((sum, hotspot) => sum + hotspot.confidence, 0) / harmonized.length : 0;
  const intensityScore = Math.min(100, Math.round(
    Math.min(totalFRP / 5000, 1) * 50 +
    Math.min(harmonized.length / 200, 1) * 35 +
    Math.min(Math.max(meanBrightness - 300, 0) / 200, 1) * 15,
  ));

  return {
    date: data.date,
    dayOfYear: Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    year: date.getUTCFullYear(),
    modisCount: modis.length,
    viirsCount: viirs.length,
    harmonizedCount: harmonized.length,
    totalFRP: Math.round(totalFRP),
    meanBrightness: Math.round(meanBrightness * 10) / 10,
    meanConfidence: Math.round(meanConfidence),
    intensity: intensityScore >= 80 ? 'extreme' : intensityScore >= 60 ? 'very-high' : intensityScore >= 40 ? 'high' : intensityScore >= 20 ? 'moderate' : 'low',
    intensityScore,
    highConfidenceRatio: harmonized.length
      ? harmonized.filter((hotspot) => hotspot.confidence >= 70).length / harmonized.length : 0,
  };
}

export function createLiveEarlyWarning(summary: DailyFireSummary, region: Region): EarlyWarning {
  const { harmonizedCount, totalFRP } = summary;
  const intensity = totalFRP / Math.max(harmonizedCount, 1);
  const level = harmonizedCount >= 20000 || totalFRP >= 100000
    ? 'extreme'
    : harmonizedCount >= 5000 || totalFRP >= 25000
      ? 'warning'
      : harmonizedCount >= 1000 || totalFRP >= 5000
        ? 'watch'
        : harmonizedCount > 0
          ? 'advisory'
          : 'normal';
  const title = level === 'extreme'
    ? 'Immediate operational attention'
    : level === 'warning'
      ? 'Elevated fire activity detected'
      : level === 'watch'
        ? 'Active fire monitoring advised'
        : level === 'advisory'
          ? 'Detections requiring review'
          : 'No FIRMS detections in this region';

  return {
    level,
    title,
    message: `${harmonizedCount.toLocaleString()} spatially harmonized FIRMS detections were observed in ${region.name} in the last 24 hours. This is a live satellite observation signal, not a fire-spread forecast; confirm conditions with field reports, weather, and local authorities.`,
    region: region.name,
    date: summary.date,
    metrics: {
      recentAvg: harmonizedCount,
      historicalAvg: Math.round(totalFRP),
      deviation: Math.round(intensity * 10) / 10,
      trend: 'stable',
    },
    recommendations: [
      'Firefighters: verify high-FRP clusters with local dispatch and field reports.',
      'Scientists: inspect sensor overlap, confidence, and acquisition times before analysis.',
      'Land managers: review access, weather, and fuel conditions before taking action.',
    ],
  };
}

export async function fetchLiveFirmsData(): Promise<LiveFireData> {
  const date = getRequestedDate();
  const cached = readCachedLiveData(date);
  if (cached) return cached;
  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = fetchLiveFirmsDataUncached(date);
  try {
    const data = await inFlightRequest;
    writeCachedLiveData(data);
    return data;
  } finally {
    inFlightRequest = null;
  }
}

async function fetchLiveFirmsDataUncached(date: string): Promise<LiveFireData> {
  const now = Date.now();
  // Suomi-NPP VIIRS delivery ended 2 Nov 2026, so live VIIRS = NOAA-20 + NOAA-21.
  const products = [
    { product: 'MODIS_NRT', source: 'MODIS' as const, satellite: 'Terra/Aqua' },
    { product: 'VIIRS_NOAA20_NRT', source: 'VIIRS' as const, satellite: 'NOAA-20' },
    { product: 'VIIRS_NOAA21_NRT', source: 'VIIRS' as const, satellite: 'NOAA-21' },
  ];
  const responses = await Promise.all(products.map(async ({ product, source, satellite }) => {
    const params = new URLSearchParams({
      product,
      area: 'world',
      days: String(FIRMS_DAY_RANGE),
      date: getRangeStart(now),
    });
    const response = await fetch(`${FIRMS_BASE_URL}?${params.toString()}`);
    const body = await response.text();
    if (!response.ok) {
      if (body.toLowerCase().includes('exceeding allowed transaction limit')) {
        throw new Error('NASA FIRMS API transaction limit reached. Wait for the quota to reset or use a new FIRMS MAP_KEY.');
      }
      const apiMessage = body.trim().split(/\r?\n/)[0];
      throw new Error(
        `NASA FIRMS ${product} request failed (${response.status})${apiMessage ? `: ${apiMessage}` : '.'}`,
      );
    }
    return parseCsv(body, source, satellite);
  }));

  // Drop the helper timestamp once rows are sorted into windows.
  const strip = (h: FireHotspot & { at: number }): FireHotspot => {
    const copy: FireHotspot & { at?: number } = { ...h };
    delete copy.at;
    return copy;
  };
  const from = now - LIVE_WINDOW_MS;
  const inWindow = (h: { at: number }) => h.at > from && h.at <= now + 60 * 60 * 1000;
  const modisHotspots = responses[0].filter(inWindow).map(strip);
  const viirsHotspots = [...responses[1], ...responses[2]].filter(inWindow).map(strip);
  const previousDayHotspots = responses.flat().filter((h) => h.at <= from && h.at > from - LIVE_WINDOW_MS).map(strip);
  if (modisHotspots.length + viirsHotspots.length === 0) {
    throw new Error('NASA FIRMS returned no MODIS or VIIRS detections in the last 24 hours.');
  }

  return {
    date,
    windowStart: new Date(from).toISOString(),
    windowEnd: new Date(now).toISOString(),
    modisHotspots,
    viirsHotspots,
    harmonizedHotspots: harmonizeLiveHotspots(modisHotspots, viirsHotspots),
    previousDayHotspots,
    fetchedAt: new Date().toISOString(),
  };
}
