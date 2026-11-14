// Area-of-interest geometry: preset region, point + radius, or drawn polygon.
import { cellToParent, latLngToCell } from 'h3-js';
import { getRegionById } from '@/data/regions';
import type { Region } from '@/types';

/**
 * Archive cell for a point, matching pipeline/harmonize.py: the res-7 parent of the
 * res-8 cell. H3 cells do not nest exactly, so near edges this differs from
 * latLngToCell(lat, lng, 7), and forensic / hex records are keyed by this one.
 */
export function archiveCell(lat: number, lng: number): string {
  return cellToParent(latLngToCell(lat, lng, 8), 7);
}

export type LatLng = [number, number];

export type Aoi =
  | { kind: 'region'; regionId: string }
  | { kind: 'point'; lat: number; lng: number; radiusKm: number }
  | { kind: 'polygon'; points: LatLng[] };

export const DEFAULT_AOI: Aoi = { kind: 'region', regionId: 'indonesia' };

const EARTH_KM = 6371;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

function pointInPolygon(lat: number, lng: number, ring: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function aoiBounds(aoi: Aoi): Region['bbox'] {
  if (aoi.kind === 'region') return getRegionById(aoi.regionId).bbox;
  if (aoi.kind === 'point') {
    const dLat = aoi.radiusKm / 111.32;
    const dLng = aoi.radiusKm / (111.32 * Math.max(Math.cos((aoi.lat * Math.PI) / 180), 0.01));
    return { minLat: aoi.lat - dLat, maxLat: aoi.lat + dLat, minLng: aoi.lng - dLng, maxLng: aoi.lng + dLng };
  }
  const lats = aoi.points.map((p) => p[0]);
  const lngs = aoi.points.map((p) => p[1]);
  return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
}

/** Exact containment test for a detection. */
export function aoiContains(aoi: Aoi, lat: number, lng: number): boolean {
  if (aoi.kind === 'region') {
    if (aoi.regionId === 'global') return true;
    const b = getRegionById(aoi.regionId).bbox;
    return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
  }
  if (aoi.kind === 'point') return haversineKm(aoi.lat, aoi.lng, lat, lng) <= aoi.radiusKm;
  const b = aoiBounds(aoi);
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return false;
  return pointInPolygon(lat, lng, aoi.points);
}

export function aoiLabel(aoi: Aoi): string {
  if (aoi.kind === 'region') return getRegionById(aoi.regionId).name;
  if (aoi.kind === 'point') return `${aoi.radiusKm} km around ${aoi.lat.toFixed(3)}, ${aoi.lng.toFixed(3)}`;
  return `Drawn area · ${aoi.points.length} vertices`;
}

/** Approximate area in km² (spherical excess is negligible at AOI scale). */
export function aoiAreaKm2(aoi: Aoi): number {
  if (aoi.kind === 'point') return Math.PI * aoi.radiusKm ** 2;
  const ring = aoi.kind === 'polygon'
    ? aoi.points
    : (() => {
      const b = aoiBounds(aoi);
      return [[b.minLat, b.minLng], [b.minLat, b.maxLng], [b.maxLat, b.maxLng], [b.maxLat, b.minLng]] as LatLng[];
    })();
  const lat0 = (ring.reduce((s, p) => s + p[0], 0) / ring.length) * (Math.PI / 180);
  const kx = 111.32 * Math.cos(lat0);
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][1] * kx) * (ring[i][0] * 110.57) - (ring[i][1] * kx) * (ring[j][0] * 110.57);
  }
  return Math.abs(sum) / 2;
}

/**
 * A Region-shaped view of any AOI so existing components (map fly-to, live
 * summaries) keep working. Custom AOIs get a synthetic id and description.
 */
export function aoiToRegion(aoi: Aoi): Region {
  if (aoi.kind === 'region') return getRegionById(aoi.regionId);
  const bbox = aoiBounds(aoi);
  const span = Math.max(bbox.maxLat - bbox.minLat, bbox.maxLng - bbox.minLng);
  const zoom = span > 10 ? 5 : span > 4 ? 6 : span > 1.5 ? 7 : span > 0.6 ? 8 : 9;
  return {
    id: aoi.kind === 'point' ? 'custom-point' : 'custom-polygon',
    name: aoi.kind === 'point' ? 'Point radius' : 'Drawn polygon',
    country: 'Custom area',
    scope: 'country',
    bbox,
    center: [(bbox.minLat + bbox.maxLat) / 2, (bbox.minLng + bbox.maxLng) / 2],
    zoom,
    bounds: [[bbox.minLat, bbox.minLng], [bbox.maxLat, bbox.maxLng]],
    fireSeason: { startMonth: 1, endMonth: 12 },
    description: `${aoiLabel(aoi)} · about ${Math.round(aoiAreaKm2(aoi)).toLocaleString()} km².`,
  };
}

// ─── URL encoding ────────────────────────────────────────────────────────────

export function encodeAoi(aoi: Aoi): Record<string, string> {
  if (aoi.kind === 'region') return { region: aoi.regionId };
  if (aoi.kind === 'point') return { point: `${aoi.lat.toFixed(4)},${aoi.lng.toFixed(4)},${aoi.radiusKm}` };
  return { poly: aoi.points.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(';') };
}

export function decodeAoi(params: URLSearchParams): Aoi | null {
  const point = params.get('point');
  if (point) {
    const [lat, lng, r] = point.split(',').map(Number);
    if ([lat, lng, r].every(Number.isFinite) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && r > 0) {
      return { kind: 'point', lat, lng, radiusKm: Math.min(r, 500) };
    }
  }
  const poly = params.get('poly');
  if (poly) {
    const points = poly.split(';').map((p) => p.split(',').map(Number) as LatLng);
    if (points.length >= 3 && points.every((p) => p.length === 2 && p.every(Number.isFinite))) {
      return { kind: 'polygon', points };
    }
  }
  const region = params.get('region');
  if (region && getRegionById(region).id === region) return { kind: 'region', regionId: region };
  return null;
}
