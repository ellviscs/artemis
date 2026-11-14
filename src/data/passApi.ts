// Next VIIRS overpass prediction for NOAA-20 and NOAA-21 from real CelesTrak TLEs
// (fetched through /api/tle) propagated with SGP4 (satellite.js).
import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  propagate,
  radiansToDegrees,
  twoline2satrec,
  type SatRec,
} from 'satellite.js';

export interface PassPrediction {
  satellite: 'NOAA-20' | 'NOAA-21';
  /** Satellite rises above the swath-edge elevation. */
  start: Date;
  /** Time of highest elevation (closest approach). */
  peak: Date;
  end: Date;
  maxElevationDeg: number;
  /** Local solar time at the peak decides day/night. */
  dayNight: 'D' | 'N';
  tleEpoch: Date;
}

const SATS = [
  { satellite: 'NOAA-20' as const, catnr: '43013' },
  { satellite: 'NOAA-21' as const, catnr: '54234' },
];

/**
 * VIIRS scans ±56° across a ~3,040 km swath from ~830 km altitude. A ground point
 * at the swath edge sees the satellite at roughly 20° elevation, so any pass above
 * that elevation puts the point inside the image.
 */
export const SWATH_EDGE_ELEVATION_DEG = 20;
const STEP_S = 30;
const HORIZON_H = 36;

const satrecCache = new Map<string, Promise<SatRec>>();

function loadSatrec(catnr: string): Promise<SatRec> {
  let hit = satrecCache.get(catnr);
  if (!hit) {
    hit = fetch(`/api/tle?catnr=${catnr}`)
      .then(async (response) => {
        const body = await response.text();
        if (!response.ok) throw new Error(body.trim() || `Orbit data unavailable (${response.status}).`);
        const lines = body.split(/\r?\n/).map((l) => l.trim());
        const l1 = lines.find((l) => l.startsWith('1 '));
        const l2 = lines.find((l) => l.startsWith('2 '));
        if (!l1 || !l2) throw new Error('Orbit data was malformed.');
        return twoline2satrec(l1, l2);
      })
      .catch((error: unknown) => {
        satrecCache.delete(catnr);
        throw error;
      });
    satrecCache.set(catnr, hit);
  }
  return hit;
}

function elevationAt(satrec: SatRec, observer: { latitude: number; longitude: number; height: number }, date: Date): number | null {
  const pv = propagate(satrec, date);
  if (!pv || typeof pv.position !== 'object') return null;
  const ecf = eciToEcf(pv.position, gstime(date));
  return radiansToDegrees(ecfToLookAngles(observer, ecf).elevation);
}

function epochOf(satrec: SatRec): Date {
  // epochyr is two-digit; epochdays is day-of-year with fraction.
  const year = satrec.epochyr < 57 ? 2000 + satrec.epochyr : 1900 + satrec.epochyr;
  return new Date(Date.UTC(year, 0, 1) + (satrec.epochdays - 1) * 86_400_000);
}

function findNextPass(satrec: SatRec, lat: number, lng: number, from: Date): Omit<PassPrediction, 'satellite' | 'tleEpoch'> | null {
  const observer = { latitude: degreesToRadians(lat), longitude: degreesToRadians(lng), height: 0 };
  const steps = (HORIZON_H * 3600) / STEP_S;
  let start: Date | null = null;
  let peak: Date | null = null;
  let maxEl = -90;
  for (let i = 0; i <= steps; i++) {
    const t = new Date(from.getTime() + i * STEP_S * 1000);
    const el = elevationAt(satrec, observer, t);
    if (el === null) continue;
    const visible = el >= SWATH_EDGE_ELEVATION_DEG;
    if (visible) {
      // A pass already in progress at `from` still counts: the image is being taken now.
      if (!start) start = t;
      if (el > maxEl) {
        maxEl = el;
        peak = t;
      }
    } else if (start && peak) {
      const solarHour = (peak.getUTCHours() + peak.getUTCMinutes() / 60 + lng / 15 + 24) % 24;
      return { start, peak, end: t, maxElevationDeg: maxEl, dayNight: solarHour >= 6 && solarHour < 18 ? 'D' : 'N' };
    }
  }
  return null;
}

/** Next pass of each live VIIRS satellite over (lat, lng), soonest first. */
export async function predictNextPasses(lat: number, lng: number, from = new Date()): Promise<PassPrediction[]> {
  const results = await Promise.all(
    SATS.map(async ({ satellite, catnr }) => {
      const satrec = await loadSatrec(catnr);
      const pass = findNextPass(satrec, lat, lng, from);
      return pass ? { ...pass, satellite, tleEpoch: epochOf(satrec) } : null;
    }),
  );
  return results.filter((p): p is PassPrediction => p !== null).sort((a, b) => a.peak.getTime() - b.peak.getTime());
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'overhead now';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor((ms % 60_000) / 1000);
  return h > 0 ? `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m` : `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}
