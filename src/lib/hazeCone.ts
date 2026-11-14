// Straight-line downwind smoke cone from the current surface wind. A screening
// aid, not a dispersion model: it assumes the wind holds speed and direction.
const R_KM = 6371;
export const CONE_HALF_ANGLE_DEG = 20;
export const CONE_HOURS = [6, 12, 24] as const;
/** YlOrRd: nearer bands (denser smoke) are darker. */
export const BAND_COLORS: Record<number, string> = { 6: '#e31a1c', 12: '#fd8d3c', 24: '#fed976' };

export type LatLngTuple = [number, number];

export interface HazeBand {
  hours: number;
  fromKm: number;
  toKm: number;
  polygon: LatLngTuple[];
}

export interface HazeConeGeometry {
  origin: LatLngTuple;
  /** Direction the smoke travels toward (wind "from" + 180°). */
  bearingDeg: number;
  windSpeed: number;
  bands: HazeBand[];
  /** Outline of the full 24 h cone. */
  outline: LatLngTuple[];
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function destination([lat, lng]: LatLngTuple, bearingDeg: number, km: number): LatLngTuple {
  const d = km / R_KM;
  const b = rad(bearingDeg);
  const p1 = rad(lat);
  const l1 = rad(lng);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [deg(p2), ((deg(l2) + 540) % 360) - 180];
}

export function bearingBetween([lat1, lng1]: LatLngTuple, [lat2, lng2]: LatLngTuple): number {
  const p1 = rad(lat1);
  const p2 = rad(lat2);
  const dl = rad(lng2 - lng1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

function arc(origin: LatLngTuple, bearing: number, km: number, reverse = false): LatLngTuple[] {
  const pts: LatLngTuple[] = [];
  for (let a = -CONE_HALF_ANGLE_DEG; a <= CONE_HALF_ANGLE_DEG; a += 4) pts.push(destination(origin, bearing + a, km));
  return reverse ? pts.reverse() : pts;
}

export function buildHazeCone(origin: LatLngTuple, windFromDeg: number, windSpeed: number): HazeConeGeometry {
  const bearingDeg = (windFromDeg + 180) % 360;
  const kmPerHour = (windSpeed * 3600) / 1000;
  let prev = 0;
  const bands = CONE_HOURS.map((hours) => {
    const toKm = Math.max(kmPerHour * hours, 1);
    const polygon = prev === 0 ? [origin, ...arc(origin, bearingDeg, toKm)] : [...arc(origin, bearingDeg, prev), ...arc(origin, bearingDeg, toKm, true)];
    const band = { hours, fromKm: prev, toKm, polygon };
    prev = toKm;
    return band;
  });
  return { origin, bearingDeg, windSpeed, bands, outline: [origin, ...arc(origin, bearingDeg, prev)] };
}

/** Which band a point falls in, or null if it is outside the cone. */
export function bandFor(cone: HazeConeGeometry, distKm: number, bearing: number): HazeBand | null {
  const off = Math.abs(((bearing - cone.bearingDeg + 540) % 360) - 180);
  if (off > CONE_HALF_ANGLE_DEG) return null;
  return cone.bands.find((b) => distKm > b.fromKm && distKm <= b.toKm) ?? (distKm <= cone.bands[0].toKm ? cone.bands[0] : null);
}
