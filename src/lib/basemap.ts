import L from 'leaflet';

// Same CARTO dark styles and optional key as the main FireMap.
const KEY = import.meta.env.VITE_CARTO_API_KEY ? `?key=${import.meta.env.VITE_CARTO_API_KEY}` : '';

/** Adds the dark CARTO basemap (and optionally its label layer) to a Leaflet map. */
export function addCartoBasemap(map: L.Map, { labels = false, maxZoom = 17 } = {}): void {
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}.png${KEY}`, {
    maxZoom,
    attribution: '© OpenStreetMap contributors © CARTO',
  }).addTo(map);
  if (labels) {
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}.png${KEY}`, { maxZoom, pane: 'shadowPane' }).addTo(map);
  }
}
