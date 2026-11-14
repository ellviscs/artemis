import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { cellToBoundary, cellToLatLng } from 'h3-js';
import { Radio, ScanLine } from 'lucide-react';

import {
  MONTH_LABELS,
  fetchArchiveHotspots,
  fetchHexYear,
  fetchHistoryMeta,
  fetchStaticSources,
  type HexYear,
  type StaticSource,
} from '@/data/historyApi';
import { rampColor, RAMPS } from '@/lib/colorRamps';
import { cn } from '@/lib/utils';
import { useFilters } from '@/state/filters';
import { currentYearMonth, ymKey } from '@/state/yearMonth';
import type { FireHotspot } from '@/types';
import type { InspectTarget } from '@/components/HotspotInspector';

const MAX_HEXES = 12000;
const MAX_ELLIPSES = 1500;
const ELLIPSE_ZOOM = 9;

interface Footprint {
  lat: number;
  lng: number;
  scan: number;
  track: number;
  frp: number;
  label: string;
}

/** Approximate a FIRMS pixel footprint: scan (km, across-track ≈ east–west) × track (km, north–south). */
function ellipse(lat: number, lng: number, scanKm: number, trackKm: number, steps = 20): L.LatLngExpression[] {
  const a = Math.max(scanKm, 0.2) / 2 / (111.32 * Math.cos((lat * Math.PI) / 180));
  const b = Math.max(trackKm, 0.2) / 2 / 110.57;
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * Math.PI * 2;
    return [lat + b * Math.sin(t), lng + a * Math.cos(t)] as L.LatLngExpression;
  });
}

function useMapView(map: L.Map | null) {
  const [view, setView] = useState<{ bounds: L.LatLngBounds; zoom: number } | null>(null);
  useEffect(() => {
    if (!map) return;
    const update = () => setView({ bounds: map.getBounds().pad(0.15), zoom: map.getZoom() });
    update();
    map.on('moveend', update);
    return () => {
      map.off('moveend', update);
    };
  }, [map]);
  return view;
}

export function ArchiveMapLayers({
  map,
  liveHotspots,
  onInspect,
}: {
  map: L.Map | null;
  liveHotspots: FireHotspot[];
  onInspect?: (target: InspectTarget) => void;
}) {
  const { focus, ramp, maskStatic, setFilters } = useFilters();
  const view = useMapView(map);
  const [hex, setHex] = useState<HexYear | null>(null);
  const [hexError, setHexError] = useState<string | null>(null);
  const [showStatic, setShowStatic] = useState(false);
  const [staticSources, setStaticSources] = useState<StaticSource[] | null>(null);
  const [footprints, setFootprints] = useState<Footprint[]>([]);
  const groups = useRef<{ hex: L.LayerGroup; ellipses: L.LayerGroup; statics: L.LayerGroup; renderer: L.Canvas } | null>(null);

  const isCurrent = focus ? ymKey(focus) === ymKey(currentYearMonth()) : false;

  // Create panes + layer groups once per map.
  useEffect(() => {
    if (!map) return;
    if (!map.getPane('archivePane')) map.createPane('archivePane').style.zIndex = '405';
    if (!map.getPane('ellipsePane')) map.createPane('ellipsePane').style.zIndex = '415';
    const renderer = L.canvas({ pane: 'archivePane', padding: 0.2 });
    const g = {
      hex: L.layerGroup().addTo(map),
      ellipses: L.layerGroup().addTo(map),
      statics: L.layerGroup().addTo(map),
      renderer,
    };
    groups.current = g;
    return () => {
      g.hex.remove();
      g.ellipses.remove();
      g.statics.remove();
      groups.current = null;
    };
  }, [map]);

  // Load the hex grid for the focused year.
  useEffect(() => {
    setHex(null);
    setHexError(null);
    if (!focus) return;
    let cancelled = false;
    fetchHexYear(focus.year)
      .then((h) => !cancelled && setHex(h))
      .catch((e: unknown) => !cancelled && setHexError(e instanceof Error ? e.message : 'Hex grid unavailable.'));
    return () => {
      cancelled = true;
    };
  }, [focus?.year]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cells for the focused month + a robust colour ceiling (99th percentile).
  const monthCells = useMemo(() => {
    if (!hex || !focus) return null;
    const ids: string[] = [];
    const values: number[] = [];
    for (let i = 0; i < hex.value.length; i++) {
      if (hex.month[i] === focus.month) {
        ids.push(hex.cells[hex.cell[i]]);
        values.push(hex.value[i]);
      }
    }
    const sorted = [...values].sort((a, b) => a - b);
    const ceiling = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1] : 1;
    const total = values.reduce((s, v) => s + v, 0);
    return { ids, values, ceiling: Math.max(ceiling, 1), total };
  }, [hex, focus]);

  // Draw hexes inside the current view.
  useEffect(() => {
    const g = groups.current;
    if (!g) return;
    g.hex.clearLayers();
    if (!monthCells || !view || !focus) return;
    const top = Math.log1p(monthCells.ceiling);
    const visible: { id: string; v: number; boundary: [number, number][] }[] = [];
    for (let i = 0; i < monthCells.ids.length; i++) {
      const boundary = cellToBoundary(monthCells.ids[i]) as [number, number][];
      const [lat, lng] = boundary[0];
      if (view.bounds.contains([lat, lng])) visible.push({ id: monthCells.ids[i], v: monthCells.values[i], boundary });
    }
    visible.sort((a, b) => b.v - a.v);
    const label = `${MONTH_LABELS[focus.month - 1]} ${focus.year}`;
    for (const cell of visible.slice(0, MAX_HEXES)) {
      const t = Math.min(Math.log1p(cell.v) / top, 1);
      const color = rampColor(ramp, 0.08 + 0.92 * t);
      L.polygon(cell.boundary, {
        renderer: g.renderer,
        pane: 'archivePane',
        stroke: view.zoom >= 8,
        color: '#050505',
        weight: 0.5,
        fillColor: color,
        fillOpacity: 0.85,
      })
        .bindTooltip(`${label} · ${cell.v.toFixed(1)} MODIS-equivalent fire cell-days`, { sticky: true, className: 'custom-popup' })
        .on('click', () => {
          const [lat, lng] = cellToLatLng(cell.id);
          onInspect?.({ lat, lng, cell: cell.id, archive: { year: focus.year, month: focus.month, value: cell.v } });
        })
        .addTo(g.hex);
    }
  }, [monthCells, view, ramp, focus, onInspect]);

  // Detection footprints at high zoom: archive detections for the focused month, or live ones.
  useEffect(() => {
    let cancelled = false;
    if (!view || view.zoom < ELLIPSE_ZOOM) {
      setFootprints([]);
      return;
    }
    if (!focus || isCurrent) {
      setFootprints(
        liveHotspots
          .filter((h) => view.bounds.contains([h.lat, h.lng]) && h.scan > 0)
          .slice(0, MAX_ELLIPSES)
          .map((h) => ({ lat: h.lat, lng: h.lng, scan: h.scan, track: h.track, frp: h.frp, label: `${h.source}${h.satellite ? ` · ${h.satellite}` : ''} · ${h.acqTime} UTC` })),
      );
      return;
    }
    fetchHistoryMeta()
      .then(async (meta) => {
        const regions = Object.entries(meta.regions).filter(([, r]) => {
          if (!r.points || !r.bounds) return false;
          const [minLat, minLng, maxLat, maxLng] = r.bounds;
          return view.bounds.intersects(L.latLngBounds([minLat, minLng], [maxLat, maxLng]));
        });
        const rows = (await Promise.all(regions.map(([id]) => fetchArchiveHotspots(id, focus.year)))).flat();
        const prefix = `${focus.year}-${String(focus.month).padStart(2, '0')}`;
        const out = rows
          .filter((h) => h.date.startsWith(prefix) && (!maskStatic || !h.static) && view.bounds.contains([h.lat, h.lon]))
          .slice(0, MAX_ELLIPSES)
          .map((h) => ({ lat: h.lat, lng: h.lon, scan: h.scan, track: h.track, frp: h.frp, label: `${h.sensor} · ${h.date} ${h.time.slice(0, 2)}:${h.time.slice(2)} UTC` }));
        if (!cancelled) setFootprints(out);
      })
      .catch(() => !cancelled && setFootprints([]));
    return () => {
      cancelled = true;
    };
  }, [view, focus, isCurrent, liveHotspots, maskStatic]);

  useEffect(() => {
    const g = groups.current;
    if (!g) return;
    g.ellipses.clearLayers();
    for (const f of footprints) {
      L.polygon(ellipse(f.lat, f.lng, f.scan, f.track), {
        pane: 'ellipsePane',
        color: '#ffc75d',
        weight: 1,
        opacity: 0.9,
        fillColor: '#ffc75d',
        fillOpacity: 0.08,
      })
        .bindTooltip(`${f.label}<br/>FRP ${f.frp.toFixed(1)} MW · pixel ≈ ${f.scan.toFixed(2)} × ${f.track.toFixed(2)} km`, { sticky: true, className: 'custom-popup' })
        .addTo(g.ellipses);
    }
  }, [footprints]);

  // Static heat sources removed by the mask (optional overlay).
  useEffect(() => {
    if (!showStatic || staticSources) return;
    fetchStaticSources().then((s) => setStaticSources(s.sources)).catch(() => setStaticSources([]));
  }, [showStatic, staticSources]);

  useEffect(() => {
    const g = groups.current;
    if (!g) return;
    g.statics.clearLayers();
    if (!showStatic || !staticSources || !view) return;
    staticSources
      .filter((s) => view.bounds.contains([s.lat, s.lon]))
      .slice(0, 4000)
      .forEach((s) => {
        L.circleMarker([s.lat, s.lon], {
          renderer: g.renderer,
          radius: 3,
          color: '#a1a1a1',
          weight: 1,
          fillColor: '#050505',
          fillOpacity: 1,
        })
          .bindTooltip(
            `Masked static heat · ${s.reason === 'persistent' ? `burns year-round (max ${s.maxDays} days/yr)` : s.reason}`,
            { className: 'custom-popup' },
          )
          .addTo(g.statics);
      });
  }, [showStatic, staticSources, view]);

  const zoomedIn = (view?.zoom ?? 0) >= ELLIPSE_ZOOM;
  const top = monthCells ? monthCells.ceiling : 1;

  return (
    <div className="pointer-events-none absolute left-3 top-[5rem] z-[1000] flex max-w-[calc(100%-1.5rem)] flex-col gap-2 sm:left-5 sm:top-[5.75rem]">
      {focus && (
        <div className="pointer-events-auto w-64 rounded-[6px] border border-white/[0.1] bg-[#0b0d0b]/90 p-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
              {MONTH_LABELS[focus.month - 1]} {focus.year} · ~5 km² hexes
            </span>
            <button
              type="button"
              onClick={() => setFilters({ focus: null })}
              className="flex items-center gap-1 rounded-[4px] border border-white/[0.14] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-white/60 hover:border-white/30 hover:text-white"
            >
              <Radio className="h-3 w-3" /> Live
            </button>
          </div>
          {hexError ? (
            <p className="mt-2 text-[11px] text-[#fca5a5]">{hexError}</p>
          ) : !monthCells ? (
            <p className="mt-2 text-[11px] text-white/50">Loading hex grid…</p>
          ) : (
            <>
              <div className="mt-2 h-2 rounded-[2px]" style={{ background: `linear-gradient(to right, ${Array.from({ length: 10 }, (_, i) => rampColor(ramp, 0.08 + 0.92 * (i / 9))).join(', ')})` }} />
              <div className="mt-1 flex justify-between font-mono text-[9px] tabular-nums text-white/45">
                <span>&lt;1</span>
                <span>{Math.round(Math.expm1(Math.log1p(top) / 2))}</span>
                <span>{Math.round(top)}+ cell-days</span>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-white/55">
                {monthCells.ids.length.toLocaleString('en-US')} active hexes in Indonesia · {RAMPS[ramp].label}, log scale.
                {!maskStatic && ' The hex grid always excludes static heat.'}
              </p>
            </>
          )}
        </div>
      )}
      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowStatic((v) => !v)}
          aria-pressed={showStatic}
          className={cn(
            'rounded-[4px] border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] backdrop-blur-md transition-colors',
            showStatic ? 'border-white/40 bg-white/[0.12] text-white' : 'border-white/[0.14] bg-[#0b0d0b]/85 text-white/60 hover:text-white',
          )}
        >
          Masked heat sources
        </button>
        <span className="flex items-center gap-1 rounded-[4px] border border-white/[0.1] bg-[#0b0d0b]/85 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-white/50 backdrop-blur-md">
          <ScanLine className="h-3 w-3" />
          {zoomedIn ? `${footprints.length.toLocaleString('en-US')} pixel footprints` : 'Zoom in for pixel footprints'}
        </span>
      </div>
    </div>
  );
}
