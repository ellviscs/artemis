// Schools and health facilities from OpenStreetMap via the public Overpass API.
// Only the cone polygon is sent; no user data.
import type { LatLngTuple } from '@/lib/hazeCone';

export type FacilityKind = 'school' | 'health';

export interface Facility {
  id: string;
  name: string;
  kind: FacilityKind;
  /** OSM tag value, e.g. school, kindergarten, clinic, hospital. */
  type: string;
  lat: number;
  lng: number;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
export const FACILITY_LIMIT = 500;
const cache = new Map<string, Promise<Facility[]>>();

// Not abortable on purpose: the promise is shared through the cache, so callers
// ignore stale results instead of cancelling the request for everyone.
export function fetchFacilitiesInPolygon(polygon: LatLngTuple[]): Promise<Facility[]> {
  const poly = polygon.map(([lat, lng]) => `${lat.toFixed(4)} ${lng.toFixed(4)}`).join(' ');
  const hit = cache.get(poly);
  if (hit) return hit;
  const query = `[out:json][timeout:25];
(
  nwr["amenity"~"^(school|kindergarten)$"](poly:"${poly}");
  nwr["amenity"~"^(clinic|hospital|doctors)$"](poly:"${poly}");
  nwr["healthcare"~"^(clinic|hospital|centre)$"](poly:"${poly}");
);
out center ${FACILITY_LIMIT};`;
  const request = fetch(ENDPOINT, {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
  })
    .then(async (response) => {
      if (response.status === 429 || response.status === 504) throw new Error('OpenStreetMap Overpass is busy. Try again in a minute.');
      if (!response.ok) throw new Error(`Overpass request failed (${response.status}).`);
      const data = (await response.json()) as { elements?: OverpassElement[] };
      const seen = new Set<string>();
      return (data.elements ?? []).flatMap((el): Facility[] => {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        const tags = el.tags ?? {};
        if (lat === undefined || lng === undefined) return [];
        const type = tags.amenity ?? tags.healthcare ?? 'facility';
        const kind: FacilityKind = type === 'school' || type === 'kindergarten' ? 'school' : 'health';
        const name = tags.name ?? tags['name:id'] ?? tags['name:en'] ?? '';
        const key = `${kind}:${name}:${lat.toFixed(3)}:${lng.toFixed(3)}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ id: `${el.type}/${el.id}`, name: name || `Unnamed ${type}`, kind, type, lat, lng }];
      });
    })
    .catch((error: unknown) => {
      cache.delete(poly);
      throw error;
    });
  cache.set(poly, request);
  return request;
}
