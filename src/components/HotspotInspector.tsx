import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudOff, HandHeart, Info, Moon, ShieldCheck, X } from 'lucide-react';

import { MONTH_LABELS, fetchForensicCell, type ForensicCell } from '@/data/historyApi';
import { reverseGeocode } from '@/data/locationApi';
import { haversineKm } from '@/lib/aoi';
import { cn } from '@/lib/utils';
import type { FireHotspot } from '@/types';

export interface InspectTarget {
  lat: number;
  lng: number;
  /** H3 res-7 cell id. */
  cell: string;
  live?: FireHotspot;
  archive?: { year: number; month: number; value: number };
}

interface Props {
  target: InspectTarget;
  onClose: () => void;
  todayHotspots: FireHotspot[];
  previousDayHotspots: FireHotspot[];
}

const PERSISTENCE_RADIUS_KM = 10;
const SAME_FIRE_KM = 1.5;

function tier(percentile: number) {
  if (percentile >= 90) return { label: 'High signature', cls: 'text-[#fca5a5]', bar: '#fca5a5' };
  if (percentile >= 75) return { label: 'Elevated signature', cls: 'text-[#fdba74]', bar: '#fdba74' };
  if (percentile >= 40) return { label: 'Moderate signature', cls: 'text-[#fcd34d]', bar: '#fcd34d' };
  return { label: 'Low signature', cls: 'text-[#6ee7b7]', bar: '#6ee7b7' };
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#111111] px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/55">{label}</dt>
      <dd className="mt-0.5 font-mono text-[13px] tabular-nums text-white/90">{value}</dd>
    </div>
  );
}

function FeatureRow({ name, weight, value, detail }: { name: string; weight: number; value: number | null; detail: string }) {
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-white/85">{name}</span>
        <span className="font-mono text-[11px] tabular-nums text-white/60">
          {value === null ? 'n/a' : value.toFixed(2)} · w {weight.toFixed(2)}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-[1px] bg-white/[0.06]">
        {value !== null && <div className="h-full bg-white/60" style={{ width: `${Math.round(value * 100)}%` }} />}
      </div>
      <p className="mt-1.5 text-[12px] leading-5 text-white/55">{detail}</p>
    </li>
  );
}

function HistoryBars({ f }: { f: ForensicCell }) {
  const max = Math.max(1, ...f.yearly);
  const peakIdx = f.yearly.indexOf(max);
  return (
    <div>
      <div className="flex h-14 items-end gap-[2px]" role="img" aria-label={`Fire cell-days per year in this cell, ${f.years[0]}–${f.years[f.years.length - 1]}. Peak ${f.years[peakIdx]} with ${max}.`}>
        {f.yearly.map((v, i) => (
          <div
            key={f.years[i]}
            title={`${f.years[i]}: ${v} fire cell-days`}
            className={cn('flex-1 rounded-t-[1px]', v === 0 ? 'bg-white/[0.06]' : i === peakIdx ? 'bg-[#ffc75d]' : 'bg-white/45')}
            style={{ height: v === 0 ? 2 : `${Math.max(8, (v / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-white/55">
        <span>{f.years[0]}</span>
        <span>peak {f.years[peakIdx]} · {max} cell-days</span>
        <span>{f.years[f.years.length - 1]}</span>
      </div>
    </div>
  );
}

export function HotspotInspector({ target, onClose, todayHotspots, previousDayHotspots }: Props) {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [forensic, setForensic] = useState<{ status: 'loading' | 'ready' | 'none' | 'error'; data?: ForensicCell }>({ status: 'loading' });
  const [showMethod, setShowMethod] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setPlace(null);
    setForensic({ status: 'loading' });
    reverseGeocode(target.lat, target.lng)
      .then((r) => !cancelled && setPlace(r.displayName))
      .catch(() => !cancelled && setPlace(null));
    fetchForensicCell(target.cell)
      .then((data) => !cancelled && setForensic(data ? { status: 'ready', data } : { status: 'none' }))
      .catch(() => !cancelled && setForensic({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [target.lat, target.lng, target.cell]);

  // Cells that burned yesterday nearby but show nothing today: cloud cover can hide active fires.
  const obscured = useMemo(() => {
    if (!target.live || !previousDayHotspots.length) return 0;
    const near = (a: FireHotspot) => haversineKm(target.lat, target.lng, a.lat, a.lng) <= PERSISTENCE_RADIUS_KM;
    const today = todayHotspots.filter(near);
    return previousDayHotspots
      .filter(near)
      .filter((y) => !today.some((t) => haversineKm(y.lat, y.lng, t.lat, t.lng) <= SAME_FIRE_KM)).length;
  }, [target, todayHotspots, previousDayHotspots]);

  const h = target.live;
  const f = forensic.data;
  const t = f ? tier(f.percentile) : null;

  return (
    <aside
      aria-labelledby="inspector-title"
      className="fixed inset-x-0 bottom-0 z-[1500] flex max-h-[85vh] flex-col border-t border-white/[0.14] bg-[#0b0b0b] shadow-[0_-24px_80px_rgba(0,0,0,0.55)] animate-slide-down sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-0 sm:max-h-none sm:w-[26rem] sm:border-l sm:border-t-0 sm:shadow-[-24px_0_80px_rgba(0,0,0,0.45)]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[#9dadbe]/15 px-4 py-3">
        <div className="min-w-0">
          <h2 id="inspector-title" ref={headingRef} tabIndex={-1} className="font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-white/90 outline-none">
            Hotspot inspector
          </h2>
          <p className="mt-1 truncate text-sm text-white/75">{place ?? 'Locating…'}</p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-white/55">
            {target.lat.toFixed(4)}, {target.lng.toFixed(4)} · cell {target.cell.slice(0, 9)}…
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close inspector" className="rounded-[4px] p-1.5 text-white/60 hover:bg-white/[0.06] hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {h && (
          <section aria-label="Detection">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-white/[0.12] bg-white/[0.08]">
              <Readout label="FRP" value={`${h.frp.toFixed(1)} MW`} />
              <Readout label="Confidence" value={`${h.confidence}%`} />
              <Readout label="Sensor" value={`${h.source}${h.satellite ? ` · ${h.satellite}` : ''}`} />
              <Readout label="Overpass" value={`${h.dayNight === 'N' ? 'Night' : h.dayNight === 'D' ? 'Day' : '—'} · ${h.acqTime} UTC`} />
              <Readout label="Pixel" value={h.scan ? `${h.scan.toFixed(2)} × ${h.track.toFixed(2)} km` : '—'} />
              <Readout label="Brightness" value={h.brightness ? `${h.brightness.toFixed(1)} K` : '—'} />
            </dl>
          </section>
        )}
        {target.archive && (
          <p className="rounded-[4px] border border-white/[0.12] bg-[#111111] px-3 py-2 text-[13px] text-white/75">
            <span className="font-mono tabular-nums text-white">{target.archive.value.toFixed(1)}</span> MODIS-equivalent fire cell-days in this ~5 km² cell in{' '}
            {MONTH_LABELS[target.archive.month - 1]} {target.archive.year}.
          </p>
        )}

        {obscured > 0 && (
          <p className="flex gap-2 rounded-[4px] border border-[#7dd3fc]/30 bg-[#7dd3fc]/[0.06] px-3 py-2 text-[12px] leading-5 text-white/75">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-[#7dd3fc]" />
            <span>
              <strong className="font-semibold text-[#7dd3fc]">Cloud-obscured persistence.</strong> {obscured} detection
              {obscured === 1 ? '' : 's'} within {PERSISTENCE_RADIUS_KM} km burned yesterday with nothing seen today. Clouds or smoke
              can hide active fire; treat this as unconfirmed, not extinguished.
            </span>
          </p>
        )}
        {h?.source === 'VIIRS' && h.dayNight === 'N' && (
          <p className="flex gap-2 rounded-[4px] border border-white/[0.12] bg-[#111111] px-3 py-2 text-[12px] leading-5 text-white/70">
            <Moon className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
            Night VIIRS I-4 (3.74 µm) detection. Low-temperature smouldering such as peat (under 500 K) is easiest to see at
            night, when there is no reflected sunlight.
          </p>
        )}

        <section aria-labelledby="signature-title" className="rounded-[4px] border border-white/[0.12] bg-[#111111]">
          <div className="border-b border-white/[0.08] px-3 py-2.5">
            <h3 id="signature-title" className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/85">
              Anthropogenic thermal signature
            </h3>
          </div>
          <div className="px-3 py-3">
            {forensic.status === 'loading' && <p className="text-sm text-white/55">Reading the 20-year cell history…</p>}
            {forensic.status === 'error' && <p className="text-sm text-[#fca5a5]">The signature data could not be loaded. Close and reopen the inspector to retry.</p>}
            {forensic.status === 'none' && (
              <p className="text-sm leading-6 text-white/60">
                Fewer than 3 days of fire activity in this cell since 2001, so there is too little history to score.
              </p>
            )}
            {f && t && (
              <>
                <div className="flex items-baseline gap-3">
                  <span className={cn('font-mono text-3xl font-bold tabular-nums', t.cls)}>{Math.round(f.score)}</span>
                  <span className="font-mono text-xs text-white/55">/ 100</span>
                  <span className={cn('ml-auto text-xs font-medium', t.cls)}>{t.label}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-[1px] bg-white/[0.06]">
                  <div className="h-full" style={{ width: `${f.score}%`, backgroundColor: t.bar }} />
                </div>
                <p className="mt-2 text-[12px] leading-5 text-white/60">
                  Higher than <span className="font-mono tabular-nums text-white/85">{Math.round(f.percentile)}%</span> of
                  Indonesian fire cells. A rule-based score from four features, not a calibrated probability.
                </p>
                <ul className="mt-1 divide-y divide-white/[0.06]">
                  <FeatureRow
                    name="Off-season burning"
                    weight={0.3}
                    value={f.offSeason}
                    detail={
                      f.offSeason >= 0.4
                        ? `Many detections fall in ${f.province}'s low-fire months, when natural fire risk is usually low. Drought-anomaly months count half.`
                        : `Most detections fall in ${f.province}'s usual fire season, which is consistent with weather-driven burning.`
                    }
                  />
                  <FeatureRow
                    name="Geometric regularity"
                    weight={0.2}
                    value={f.geometry}
                    detail={f.geometry === null ? 'No day with 5+ VIIRS detections here, so shape could not be measured.' : 'How line-like same-day VIIRS detections are (0 round, 1 straight). Rows and grid edges score high.'}
                  />
                  <FeatureRow
                    name="Afternoon timing"
                    weight={0.15}
                    value={f.timing}
                    detail={`${Math.round(f.afternoonShare * 100)}% of detections at the afternoon overpass, ${f.timing >= 0.5 ? 'more' : 'less'} than most cells in ${f.province}. ${Math.round(f.nightShare * 100)}% at night.`}
                  />
                  <FeatureRow
                    name="Multi-year recurrence"
                    weight={0.35}
                    value={f.recurrence}
                    detail={`Burned in ${f.activeYears} of ${f.years.length} years; ${Math.round(f.cycleShare * 100)}% of gaps between burn years last 3–5 years.`}
                  />
                </ul>
                <button
                  type="button"
                  onClick={() => setShowMethod((v) => !v)}
                  aria-expanded={showMethod}
                  className="mt-2 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#ffc75d] hover:text-[#ffe09a]"
                >
                  <Info className="h-3.5 w-3.5" /> {showMethod ? 'Hide method' : 'How this is scored'}
                </button>
                {showMethod && (
                  <p className="mt-2 text-[12px] leading-5 text-white/60">
                    Score = 100 × (0.30 off-season + 0.20 geometry + 0.15 timing + 0.35 recurrence), each feature 0–1,
                    computed from NASA FIRMS detections 2001–2026 with static heat sources removed. It flags patterns
                    typical of managed land clearing. It does not identify who lit a fire or why, and needs field
                    verification.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {f && (
          <section aria-labelledby="history-title">
            <h3 id="history-title" className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/85">
              Fire history of this cell
            </h3>
            <HistoryBars f={f} />
            <p className="mt-1.5 text-[11px] text-white/55">Last activity {f.lastActive} · max FRP {f.maxFrp.toFixed(1)} MW</p>
          </section>
        )}

        <section aria-labelledby="recovery-title" className="rounded-[4px] border border-dashed border-white/[0.16] px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <h3 id="recovery-title" className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/85">
              Post-fire recovery check
            </h3>
            <span className="rounded-[2px] border border-[#fcd34d]/25 bg-[#fcd34d]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#fcd34d]">
              Planned
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-white/60">
            How the score would be validated: compare vegetation (NDVI) and canopy cover one to two years after a fire.
            Natural vegetation regrowing points to a natural burn; permanent forest loss or a regular plantation pattern
            points to land clearing. These labels would train a supervised model. NDVI data is not loaded in this build.
          </p>
        </section>

        <p className="flex gap-2 text-[11px] leading-5 text-white/55">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6ee7b7]/70" />
          Satellite observations and a statistical signature only. Confirm with field reports and local authorities before acting.
        </p>
      </div>

      <footer className="grid grid-cols-2 gap-2 border-t border-white/[0.1] px-4 py-3">
        <button
          type="button"
          disabled
          title="The Impact Hub arrives in the next build"
          className="flex items-center justify-center gap-1.5 rounded-[6px] border border-white/[0.14] px-3 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/55 disabled:cursor-not-allowed"
        >
          <HandHeart className="h-3.5 w-3.5" /> Impact hub · soon
        </button>
        <button
          type="button"
          onClick={() => navigate(`/audit?cell=${target.cell}&lat=${target.lat.toFixed(4)}&lng=${target.lng.toFixed(4)}`)}
          className="flex items-center justify-center gap-1.5 rounded-[6px] bg-accent-500 px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-black hover:bg-accent-400"
        >
          Run compliance audit
        </button>
      </footer>
    </aside>
  );
}
