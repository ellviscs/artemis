import type { DailyFireSummary, EarlyWarning, FireHotspot, Region } from '@/types';

// Requests go through the server-side proxy (/api/firms), which holds the MAP_KEY.
const FIRMS_BASE_URL = '/api/firms';
// Two-day window (yesterday + today) so the UTC acq_date covers the visitor's
// local date in any timezone. Results are filtered to that date below.
const FIRMS_DAY_RANGE = 2;
const LIVE_CACHE_TTL_MS = 30 * 60 * 1000;
const LIVE_CACHE_PREFIX = 'artemis-firms-live-v2:';
let inFlightRequest: Promise<LiveFireData> | null = null;

export interface LiveFireData {
  date: string;
  modisHotspots: FireHotspot[];
  viirsHotspots: FireHotspot[];
  harmonizedHotspots: FireHotspot[];
  /** Detections from the previous day (MODIS + VIIRS), used for persistence checks. */
  previousDayHotspots?: FireHotspot[];
  fetchedAt: string;
}

interface CachedLiveFireData {
  savedAt: number;
  data: LiveFireData;
}

function readCachedLiveData(date: string): LiveFireData | null {
  if (typeof window === 'undefined') return null;

  const raw = window.sessionStorage.getItem(`${LIVE_CACHE_PREFIX}${date}`);
  if (!raw) return null;

  const cached = JSON.parse(raw) as CachedLiveFireData;
  if (!Number.isFinite(cached.savedAt) || Date.now() - cached.savedAt > LIVE_CACHE_TTL_MS) {
    window.sessionStorage.removeItem(`${LIVE_CACHE_PREFIX}${date}`);
    return null;
  }
  return cached.data;
}

function writeCachedLiveData(data: LiveFireData): void {
  if (typeof window === 'undefined') return;
  const cached: CachedLiveFireData = { savedAt: Date.now(), data };
  window.sessionStorage.setItem(`${LIVE_CACHE_PREFIX}${data.date}`, JSON.stringify(cached));
}

// FIRMS returns [DATE .. DATE + DAY_RANGE - 1], so start the window early enough
// to include today.
function getRangeStart(date: string): string {
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (FIRMS_DAY_RANGE - 1));
  return start.toISOString().slice(0, 10);
}

function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
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
  dates: string[],
  fallbackSatellite: string,
): FireHotspot[] {
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
    if (!dates.includes(date) || ![lat, lng, frp].every(Number.isFinite)) return [];
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
    message: `${harmonizedCount.toLocaleString()} spatially harmonized FIRMS detections were observed in ${region.name} on ${summary.date}. This is a live satellite observation signal, not a fire-spread forecast; confirm conditions with field reports, weather, and local authorities.`,
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
      date: getRangeStart(date),
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
    return parseCsv(body, source, [date, previousDay(date)], satellite);
  }));

  const isToday = (h: FireHotspot) => h.date === date;
  const modisHotspots = responses[0].filter(isToday);
  const viirsHotspots = [...responses[1], ...responses[2]].filter(isToday);
  const previousDayHotspots = responses.flat().filter((h) => !isToday(h));
  if (modisHotspots.length + viirsHotspots.length === 0) {
    throw new Error(`NASA FIRMS returned no MODIS or VIIRS detections for ${date}.`);
  }

  return {
    date,
    modisHotspots,
    viirsHotspots,
    harmonizedHotspots: harmonizeLiveHotspots(modisHotspots, viirsHotspots),
    previousDayHotspots,
    fetchedAt: new Date().toISOString(),
  };
}
