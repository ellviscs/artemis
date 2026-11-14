import { useEffect } from 'react';
import L from 'leaflet';
import { X } from 'lucide-react';

import { BAND_COLORS, type HazeConeGeometry } from '@/lib/hazeCone';

/** Draws the Impact Hub's downwind smoke cone on the dashboard map. */
export function HazeConeLayer({ map, cone, onClear }: { map: L.Map | null; cone: HazeConeGeometry; onClear: () => void }) {
  useEffect(() => {
    if (!map) return;
    if (!map.getPane('hazePane')) map.createPane('hazePane').style.zIndex = '410';
    const group = L.featureGroup();
    [...cone.bands].reverse().forEach((b) =>
      L.polygon(b.polygon, { pane: 'hazePane', color: BAND_COLORS[b.hours], weight: 1, fillColor: BAND_COLORS[b.hours], fillOpacity: 0.2, interactive: false }).addTo(group),
    );
    group.addTo(map);
    map.getContainer().scrollIntoView({ behavior: 'smooth', block: 'center' });
    map.flyToBounds(L.latLngBounds(cone.outline), { padding: [40, 40], duration: 1.2 });
    return () => {
      group.remove();
    };
  }, [map, cone]);

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-3 rounded-[6px] border border-white/[0.14] bg-[#0b0d0b]/90 px-3 py-2 backdrop-blur-md">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/80">Haze cone</span>
      {cone.bands.map((b) => (
        <span key={b.hours} className="flex items-center gap-1 font-mono text-[10px] text-white/70">
          <span className="h-2 w-2 rounded-[1px]" style={{ backgroundColor: BAND_COLORS[b.hours] }} /> {b.hours}h
        </span>
      ))}
      <button type="button" onClick={onClear} aria-label="Remove haze cone from map" className="rounded-[4px] p-1 text-white/60 hover:bg-white/[0.08] hover:text-white">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
