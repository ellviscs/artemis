import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Copy, GraduationCap, Map as MapIcon, Send, Stethoscope, X } from 'lucide-react';

import { WeatherInfoCard } from '@/components/WeatherInfoCard';
import { addCartoBasemap } from '@/lib/basemap';
import { fetchCurrentWeather, type CurrentWeather } from '@/data/weatherApi';
import { fetchFacilitiesInPolygon, FACILITY_LIMIT, type Facility } from '@/data/facilitiesApi';
import { haversineKm } from '@/lib/aoi';
import { BAND_COLORS, bandFor, bearingBetween, buildHazeCone, CONE_HALF_ANGLE_DEG, type HazeConeGeometry } from '@/lib/hazeCone';
import { cn } from '@/lib/utils';
import type { HubContext } from './hubContext';
import { btnGhost, btnPrimary, Hint, LiveTag, Panel, SimTag } from './shared';

export type HazeCone = HazeConeGeometry;

const KIND_COLORS = { school: '#7dd3fc', health: '#c4b5fd' } as const;

interface Located extends Facility {
  distKm: number;
  hours: number;
}

function ConeMap({ cone, facilities }: { cone: HazeConeGeometry; facilities: Located[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    addCartoBasemap(map, { labels: true, maxZoom: 16 });
    [...cone.bands].reverse().forEach((b) =>
      L.polygon(b.polygon, { color: BAND_COLORS[b.hours], weight: 1, fillColor: BAND_COLORS[b.hours], fillOpacity: 0.22 })
        .bindTooltip(`${b.hours} h · up to ${Math.round(b.toKm)} km`)
        .addTo(map),
    );
    L.circleMarker(cone.origin, { radius: 6, color: '#fff', weight: 2, fillColor: '#d9831c', fillOpacity: 1 }).bindTooltip('Hotspot').addTo(map);
    facilities.forEach((f) =>
      L.circleMarker([f.lat, f.lng], { radius: 4, color: '#000', weight: 1, fillColor: KIND_COLORS[f.kind], fillOpacity: 0.95 })
        .bindTooltip(`${f.name} · ${Math.round(f.distKm)} km`)
        .addTo(map),
    );
    map.fitBounds(L.latLngBounds(cone.outline), { padding: [16, 16] });
    return () => {
      map.remove();
    };
  }, [cone, facilities]);
  return <div ref={ref} className="h-64 w-full rounded-[4px] border border-white/[0.12] bg-[#0a0a0a]" role="img" aria-label="Map of the downwind smoke cone and facilities inside it" />;
}

function alertMessage(ctx: HubContext, weather: CurrentWeather, targets: Located[]): string {
  const where = ctx.place ? ctx.place.split(',').slice(0, 2).join(',') : ctx.calendarRegion.name;
  const first = targets[0];
  const schools = targets.filter((t) => t.kind === 'school').length;
  const health = targets.length - schools;
  const group = [schools && `${schools} school${schools === 1 ? '' : 's'}`, health && `${health} health facilit${health === 1 ? 'y' : 'ies'}`].filter(Boolean).join(' and ');
  return [
    'PERINGATAN ASAP · HAZE ALERT (ARTEMIS)',
    `Satellite fire activity at ${ctx.target.lat.toFixed(4)}, ${ctx.target.lng.toFixed(4)} (${where}).`,
    `Wind from ${weather.windDirectionLabel} at ${weather.windSpeedMetersPerSecond.toFixed(1)} m/s is carrying smoke toward ${
      targets.length === 1 ? `${first.name} (~${Math.round(first.distKm)} km, within ${first.hours} h)` : `${group} within 24 h`
    }.`,
    'Keep children indoors, close windows and doors, and use N95 masks outdoors. Check with BPBD before any closure.',
    'Source: NASA FIRMS + OpenWeatherMap. Screening estimate, not a forecast.',
  ].join('\n');
}

export function HazeShieldTab({ ctx, onShowCone }: { ctx: HubContext; onShowCone?: (cone: HazeConeGeometry) => void }) {
  const { lat, lng } = ctx.target;
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [facilities, setFacilities] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; items: Facility[]; error?: string }>({ status: 'idle', items: [] });
  const [preview, setPreview] = useState<Located[] | null>(null);
  const [copied, setCopied] = useState(false);

  const loadWeather = useCallback(() => {
    let cancelled = false;
    setWeatherLoading(true);
    setWeatherError(null);
    fetchCurrentWeather(lat, lng)
      .then((w) => !cancelled && setWeather(w))
      .catch((e: unknown) => !cancelled && setWeatherError(e instanceof Error ? e.message : 'Weather unavailable.'))
      .finally(() => !cancelled && setWeatherLoading(false));
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);
  useEffect(() => loadWeather(), [loadWeather]);

  const cone = useMemo(() => (weather ? buildHazeCone([lat, lng], weather.windDirectionDegrees, weather.windSpeedMetersPerSecond) : null), [weather, lat, lng]);

  useEffect(() => {
    if (!cone) return;
    let cancelled = false;
    setFacilities({ status: 'loading', items: [] });
    fetchFacilitiesInPolygon(cone.outline)
      .then((items) => !cancelled && setFacilities({ status: 'ready', items }))
      .catch((e: unknown) => !cancelled && setFacilities({ status: 'error', items: [], error: e instanceof Error ? e.message : 'Facility lookup failed.' }));
    return () => {
      cancelled = true;
    };
  }, [cone]);

  const located = useMemo<Located[]>(() => {
    if (!cone) return [];
    return facilities.items
      .flatMap((f) => {
        const distKm = haversineKm(lat, lng, f.lat, f.lng);
        const band = bandFor(cone, distKm, bearingBetween([lat, lng], [f.lat, f.lng]));
        return band ? [{ ...f, distKm, hours: band.hours }] : [];
      })
      .sort((a, b) => a.distKm - b.distKm);
  }, [facilities.items, cone, lat, lng]);

  const counts = useMemo(() => ({ school: located.filter((f) => f.kind === 'school').length, health: located.filter((f) => f.kind === 'health').length }), [located]);

  const message = weather && preview?.length ? alertMessage(ctx, weather, preview) : '';

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="space-y-4">
        <WeatherInfoCard embedded coordinates={{ lat, lng }} weather={weather} isLoading={weatherLoading} error={weatherError} onRetry={loadWeather} />
        {cone && (
          <Panel title="Smoke cone" tag={<LiveTag>Live wind</LiveTag>}>
            <ul className="space-y-1.5">
              {cone.bands.map((b) => (
                <li key={b.hours} className="flex items-center justify-between gap-2 text-[12px] text-white/75">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-[1px]" style={{ backgroundColor: BAND_COLORS[b.hours] }} /> {b.hours} h
                  </span>
                  <span className="font-mono tabular-nums text-white/65">{Math.round(b.fromKm)}–{Math.round(b.toKm)} km</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-4 text-white/55">
              Smoke heads {Math.round(cone.bearingDeg)}° at the current surface wind, ±{CONE_HALF_ANGLE_DEG}° for direction uncertainty. Assumes the wind holds; not a dispersion model.
            </p>
            {onShowCone && (
              <button type="button" onClick={() => onShowCone(cone)} className={cn(btnGhost, 'mt-3 w-full')}>
                <MapIcon className="h-3.5 w-3.5" /> Show on main map
              </button>
            )}
          </Panel>
        )}
      </div>

      <div className="space-y-4">
        {cone && <ConeMap cone={cone} facilities={located} />}
        <Panel
          title={facilities.status === 'ready' ? `Facilities in the cone · ${counts.school} schools · ${counts.health} health` : 'Facilities in the cone'}
          tag={<LiveTag>OpenStreetMap</LiveTag>}
        >
          {!cone && <Hint>{weatherError ? 'The cone needs current wind. Retry the weather card.' : 'Waiting for current wind…'}</Hint>}
          {facilities.status === 'loading' && <Hint>Querying OpenStreetMap for schools, clinics and hospitals…</Hint>}
          {facilities.status === 'error' && <p className="text-sm text-[#fca5a5]">{facilities.error}</p>}
          {facilities.status === 'ready' && located.length === 0 && <Hint>No mapped schools or health facilities inside the 24 h cone. OpenStreetMap coverage in rural areas is incomplete.</Hint>}
          {located.length > 0 && (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-white/55">
                  Nearest first. {facilities.items.length >= FACILITY_LIMIT && `Showing the first ${FACILITY_LIMIT} returned.`}
                </p>
                <button type="button" className={btnPrimary} onClick={() => { setPreview(located); setCopied(false); }}>
                  <Send className="h-3.5 w-3.5" /> Broadcast to all {located.length}
                </button>
              </div>
              <ul className="max-h-72 divide-y divide-white/[0.06] overflow-y-auto">
                {located.slice(0, 80).map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {f.kind === 'school' ? <GraduationCap className="h-4 w-4 shrink-0" style={{ color: KIND_COLORS.school }} /> : <Stethoscope className="h-4 w-4 shrink-0" style={{ color: KIND_COLORS.health }} />}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-white/85">{f.name}</p>
                        <p className="font-mono text-[10px] text-white/55">
                          {f.type} · {Math.round(f.distKm)} km · within {f.hours} h
                        </p>
                      </div>
                    </div>
                    <button type="button" className={btnGhost} onClick={() => { setPreview([f]); setCopied(false); }} aria-label={`Preview WhatsApp haze alert for ${f.name}`}>
                      Alert
                    </button>
                  </li>
                ))}
              </ul>
              {located.length > 80 && <p className="mt-2 text-[11px] text-white/55">+{located.length - 80} more included in the broadcast.</p>}
            </>
          )}
        </Panel>

        {preview && weather && (
          <Panel title="WhatsApp haze alert preview" tag={<SimTag />}>
            <div className="flex items-start justify-between gap-2">
              <Hint>
                Pre-filled message for {preview.length === 1 ? preview[0].name : `${preview.length} principals and facility heads`}. Nothing is sent: there is no WhatsApp Business account behind this demo.
              </Hint>
              <button type="button" onClick={() => setPreview(null)} aria-label="Close preview" className="rounded-[4px] p-1 text-white/55 hover:bg-white/[0.06] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-[4px] border border-[#6ee7b7]/20 bg-[#0c1a14] p-3 font-mono text-[12px] leading-5 text-white/85">{message}</pre>
            <button
              type="button"
              className={cn(btnGhost, 'mt-3')}
              onClick={() => navigator.clipboard?.writeText(message).then(() => setCopied(true)).catch(() => setCopied(false))}
            >
              <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy text'}
            </button>
          </Panel>
        )}
      </div>
    </div>
  );
}
