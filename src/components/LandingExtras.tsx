// Landing page sections backed by real data: the telemetry ticker (meta.json + today's
// FIRMS NRT), preview cards for harmonization, the forensic score and the Impact Hub,
// and an optional tuning panel (/?tune=1) for the hero globe and the glass.
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Fingerprint, GitMerge, HandHeart, SlidersHorizontal } from 'lucide-react';

import { LiquidGlass } from '@/components/LiquidGlass';
import { DEFAULT_GLASS, setGlassParams } from '@/lib/glassParams';
import { fetchLiveFirmsData, type LiveFireData } from '@/data/firmsApi';
import { fetchForensicIndex, fetchHistoryMeta, fetchRegionCalendar, type ForensicIndex, type HistoryMeta, type MonthRecord } from '@/data/historyApi';
import { useInView } from '@/lib/useInView';
import { cn } from '@/lib/utils';
import type { EarthTuning } from '@/components/landing/earthTuning';

const fmtMonth = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

type Tone = 'live' | 'idle' | 'retired' | 'info';

function TickerItem({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <li className="flex shrink-0 items-center gap-2.5 px-6 py-3">
      <span
        aria-hidden
        className={cn('h-1.5 w-1.5 rounded-full', tone === 'live' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]' : tone === 'retired' ? 'bg-white/40' : tone === 'info' ? 'bg-accent-400' : 'bg-amber-300')}
      />
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">{label}</span>
      <span className="font-mono text-[12px] tabular-nums text-white/90">{value}</span>
    </li>
  );
}

/** A news-ticker band that scrolls the live satellite telemetry; hover or focus pauses it. */
export function TelemetryStrip() {
  const [meta, setMeta] = useState<HistoryMeta | null>(null);
  const [live, setLive] = useState<{ status: 'loading' | 'ready' | 'error'; data?: LiveFireData }>({ status: 'loading' });

  useEffect(() => {
    fetchHistoryMeta().then(setMeta).catch(() => setMeta(null));
    fetchLiveFirmsData()
      .then((data) => setLive({ status: 'ready', data }))
      .catch(() => setLive({ status: 'error' }));
  }, []);

  const counts = useMemo(() => {
    const all = live.data ? [...live.data.modisHotspots, ...live.data.viirsHotspots] : [];
    const c: Record<string, number> = { Terra: 0, Aqua: 0, 'NOAA-20': 0, 'NOAA-21': 0 };
    for (const h of all) if (h.satellite && h.satellite in c) c[h.satellite]++;
    return c;
  }, [live.data]);

  const items: { label: string; value: string; tone: Tone }[] = [
    ...(['Terra', 'Aqua', 'NOAA-20', 'NOAA-21'] as const).map((name) => ({
      label: `${name} · ${name.startsWith('NOAA') ? 'VIIRS' : 'MODIS'}`,
      value:
        live.status === 'loading' ? 'checking…' : live.status === 'error' ? 'feed unavailable' : counts[name] > 0 ? `live · ${counts[name].toLocaleString()} today` : 'no pass yet today',
      tone: (live.status === 'ready' && counts[name] > 0 ? 'live' : 'idle') as Tone,
    })),
    { label: 'Suomi-NPP · VIIRS', value: 'retired Nov 2026 · archive only', tone: 'retired' },
    { label: 'Archive', value: meta ? `${fmtMonth(meta.range.start)} – ${fmtMonth(meta.range.end)} · ${(meta.totals.detections / 1e6).toFixed(2)}M detections` : '…', tone: 'info' },
    { label: 'Static heat mask', value: meta ? `${meta.staticMask.sources.toLocaleString()} sources filtered` : '…', tone: 'info' },
    { label: 'Harmonization', value: 'VIIRS → MODIS-equivalent fire cell-days', tone: 'info' },
  ];

  return (
    <section aria-label={`Satellite telemetry${live.data ? `, ${live.data.date}` : ''}`} className="ticker relative overflow-hidden border-y border-black/20 bg-karhutla-ink text-white" tabIndex={0}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center bg-gradient-to-r from-karhutla-ink via-karhutla-ink to-transparent pl-5 pr-10 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-300">
        Live
      </div>
      {/* Two copies side by side; the track slides by half its width for a seamless loop. */}
      <div className="ticker-track flex w-max" style={{ ['--ticker-duration' as string]: '55s' }}>
        <ul className="flex">{items.map((it) => <TickerItem key={it.label} {...it} />)}</ul>
        <ul className="flex" aria-hidden>{items.map((it) => <TickerItem key={`dup-${it.label}`} {...it} />)}</ul>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-karhutla-ink to-transparent" />
    </section>
  );
}

/** Raw detections vs harmonized cell-days per year, each indexed to its 2001–2011 mean = 100. */
function HarmonizationChart() {
  const [months, setMonths] = useState<MonthRecord[] | null>(null);
  const { ref, inView } = useInView<HTMLElement>(0.4);
  useEffect(() => {
    fetchRegionCalendar('indonesia').then((c) => setMonths(c.variants.masked.months)).catch(() => setMonths(null));
  }, []);
  const series = useMemo(() => {
    if (!months) return null;
    const years = Array.from({ length: 2025 - 2001 + 1 }, (_, i) => 2001 + i);
    const sum = (y: number, k: 'rawPoints' | 'harmonized') => months.filter((m) => m.year === y).reduce((s, m) => s + (m[k] ?? 0), 0);
    const raw = years.map((y) => sum(y, 'rawPoints'));
    const har = years.map((y) => sum(y, 'harmonized'));
    const base = (a: number[]) => a.slice(0, 11).reduce((s, v) => s + v, 0) / 11;
    const rb = base(raw);
    const hb = base(har);
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    return {
      years,
      raw: raw.map((v) => (v / rb) * 100),
      har: har.map((v) => (v / hb) * 100),
      rawJump: med(raw.slice(11)) / med(raw.slice(0, 11)),
      harJump: med(har.slice(11)) / med(har.slice(0, 11)),
    };
  }, [months]);

  if (!series) return <div className="h-28 rounded-[4px] bg-black/[0.04]" aria-hidden />;
  const w = 300;
  const h = 110;
  const max = Math.max(...series.raw, ...series.har);
  const x = (i: number) => (i / (series.years.length - 1)) * w;
  const y = (v: number) => h - (v / max) * (h - 6);
  const path = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const x2012 = x(2012 - 2001);
  return (
    <figure ref={ref} className={cn('chart-draw', inView && 'is-visible')}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full overflow-visible" role="img" aria-label={`Indonesia 2001–2025: raw detection counts jump ${series.rawJump.toFixed(1)}× after VIIRS arrives in 2012; the harmonized series changes ${series.harJump.toFixed(1)}×.`}>
        <line x1={x2012} x2={x2012} y1={0} y2={h} stroke="rgba(23,23,23,0.35)" strokeDasharray="3 3" />
        <text x={x2012 + 4} y={10} fontSize="9" fill="rgba(23,23,23,0.7)" fontFamily="JetBrains Mono, monospace">VIIRS 2012</text>
        <path data-draw="1" pathLength={1} d={path(series.raw)} fill="none" stroke="#525252" strokeWidth="1.5" />
        <path data-draw="2" pathLength={1} d={path(series.har)} fill="none" stroke="#9e4324" strokeWidth="2.25" />
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-700">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-neutral-600" /> Raw detections ×{series.rawJump.toFixed(1)} after 2012</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-accent-700" /> Harmonized ×{series.harJump.toFixed(1)}: fire activity, no sensor jump</span>
      </figcaption>
    </figure>
  );
}

function SignatureScale() {
  const [idx, setIdx] = useState<ForensicIndex | null>(null);
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  useEffect(() => {
    fetchForensicIndex().then(setIdx).catch(() => setIdx(null));
  }, []);
  if (!idx) return <div className="h-28 rounded-[4px] bg-black/[0.04]" aria-hidden />;
  const q = idx.scoreQuantiles;
  const marks: [string, number][] = [['median', q['0.5']], ['p90', q['0.9']], ['p99', q['0.99']]];
  const w = idx.weights;
  return (
    <div ref={ref} className={cn('slide-marks', inView && 'is-visible')}>
      <div className="relative mt-6 h-2 rounded-[1px] bg-black/[0.08]" role="img" aria-label={`Signature scores across Indonesian fire cells: median ${q['0.5']}, 90th percentile ${q['0.9']}, 99th percentile ${q['0.99']} out of 100.`}>
        <div data-fill className="absolute inset-0 rounded-[1px]" style={{ background: 'linear-gradient(90deg, #f1cb98, #e69430, #c67438, #9e4324, #612c25)' }} />
        {marks.map(([label, v], i) => (
          <div key={label} data-mark className="absolute -top-6 text-center" style={{ left: `${v}%`, ['--i' as string]: i }}>
            <span className="block font-mono text-[10px] text-neutral-800">{label}</span>
            <span className="mx-auto mt-0.5 block h-5 w-px bg-neutral-900" />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-neutral-700"><span>0</span><span>100</span></div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-neutral-800">
        <li>Recurrence · {w.recurrence}</li>
        <li>Off-season · {w.offSeason}</li>
        <li>Geometry · {w.geometry}</li>
        <li>Afternoon timing · {w.timing}</li>
      </ul>
    </div>
  );
}

/** [label, tag for simulated parts (CLAUDE.md: escrow, payments, SMS bot, P2P board)] */
const BRANCHES: [string, string | null][] = [
  ['Satellite escrow + real VIIRS overpass timer', 'Simulated escrow'],
  ['Citizen ground-truth via SMS / WhatsApp', 'Simulated'],
  ['Downwind haze shield: live wind + OSM schools', null],
  ['Evidence dossier + P2P logistics', 'P2P demo'],
];

function ImpactLoop() {
  const { ref, inView } = useInView<HTMLUListElement>(0.4);
  return (
    <ul ref={ref} className="space-y-1.5">
      {BRANCHES.map(([label, sim], i) => (
        <li
          key={label}
          className={cn('flex items-center gap-2 text-[12px] text-neutral-900 transition-all duration-500', inView ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0')}
          style={{ transitionDelay: `${i * 110}ms` }}
        >
          <span className="font-mono text-[10px] text-neutral-700">0{i + 1}</span>
          <span className="min-w-0 flex-1">{label}</span>
          {sim && <span className="shrink-0 rounded-[2px] border border-[#5b3fa3]/40 bg-white/50 px-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[#4c3591]">{sim}</span>}
        </li>
      ))}
      <li className="pt-1 text-[11px] text-neutral-700">Payments, messaging and the P2P board are labelled simulations in the app.</li>
    </ul>
  );
}

export function FeaturePreviews({ onOpen }: { onOpen: (path: string) => void }) {
  const cards = [
    {
      icon: GitMerge,
      kicker: 'Harmonization engine',
      title: 'One record from two sensor generations',
      body: 'VIIRS sees about four times more fire pixels than MODIS. Artemis scales VIIRS to MODIS-equivalent fire cell-days, so 2001 compares with 2026.',
      visual: <HarmonizationChart />,
      cta: ['Open the burning calendar', '/dashboard'],
    },
    {
      icon: Fingerprint,
      kicker: 'Forensic signature',
      title: 'Anthropogenic thermal signature score',
      body: 'Four rule-based features from 26 years of detections in each ~5 km² cell. A score for prioritising field checks, not a probability or a finding.',
      visual: <SignatureScale />,
      cta: ['Inspect a hotspot', '/dashboard'],
    },
    {
      icon: HandHeart,
      kicker: '4-branch impact loop',
      title: 'Every hotspot leads to an action',
      body: 'From any detection: fund prevention, collect ground truth, warn schools downwind, or file a neutral evidence dossier.',
      visual: <ImpactLoop />,
      cta: ['Try the EUDR audit', '/audit?demo=b'],
    },
  ];

  return (
    <section className="thermal-field grain relative overflow-hidden">
      <div className="relative z-[2] mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:py-20">
        <div className="mb-8 max-w-2xl">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-900/70">Inside Artemis</div>
          <h2 className="mt-2 font-display text-4xl leading-[1.05] text-neutral-950 sm:text-5xl">
            Built on the <em>real</em> archive
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {cards.map(({ icon: Icon, kicker, title, body, visual, cta }) => (
            <LiquidGlass key={kicker} radius={14} className="min-h-[26rem]" contentClassName="flex flex-col p-5">
              <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-800">
                <Icon className="h-3.5 w-3.5" /> {kicker}
              </div>
              <h3 className="mt-3 font-display text-2xl leading-tight text-neutral-950">{title}</h3>
              <p className="mt-2 text-[13px] leading-6 text-neutral-800">{body}</p>
              <div className="mt-5 flex-1 rounded-[6px] border border-black/10 bg-white/45 p-4">{visual}</div>
              <button
                type="button"
                onClick={() => onOpen(cta[1])}
                className="mt-4 inline-flex items-center gap-2 self-start font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-900 underline-offset-4 hover:underline"
              >
                {cta[0]} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </LiquidGlass>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Live tuning for the hero globe and glass, shown only with /?tune=1. */
export function TuningPanel({ earth, onEarth }: { earth: EarthTuning; onEarth: (t: EarthTuning) => void }) {
  const [blur, setBlur] = useState(DEFAULT_GLASS.blurRadius);
  const [tint, setTint] = useState(DEFAULT_GLASS.tintOpacity);
  const row = (label: string, value: number, min: number, max: number, step: number, set: (v: number) => void) => (
    <label className="block">
      <span className="flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-white/70">
        {label} <span className="tabular-nums text-white">{value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="mt-1 w-full accent-[#d9831c]" />
    </label>
  );
  return (
    <aside className="fixed bottom-4 right-4 z-[2500] w-64 space-y-3 rounded-[6px] border border-white/15 bg-black/85 p-4 text-white shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
        <SlidersHorizontal className="h-3.5 w-3.5" /> Tuning
      </div>
      {row('Globe spin (rad/s)', earth.spin, 0, 0.3, 0.005, (v) => onEarth({ ...earth, spin: v }))}
      {row('Pointer lean', earth.tiltFollow, 0, 0.6, 0.02, (v) => onEarth({ ...earth, tiltFollow: v }))}
      {row('Glass blur', blur, 1, 15, 0.5, (v) => { setBlur(v); void setGlassParams({ blurRadius: v }); })}
      {row('Glass tint', tint, 0, 0.8, 0.02, (v) => { setTint(v); void setGlassParams({ tintOpacity: v }); })}
      <p className="text-[10px] leading-4 text-white/60">Tell me the values you like and I will make them the defaults.</p>
    </aside>
  );
}
