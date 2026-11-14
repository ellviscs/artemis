import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, CalendarDays, Download, Eye, Flame, Info, Loader2, Table2, TrendingDown, TrendingUp } from 'lucide-react';

import { MONTH_LABELS } from '@/data/historyApi';
import { aoiLabel } from '@/lib/aoi';
import {
  ARCHIVE_REGIONS,
  cellKey,
  describeAnomaly,
  loadAoiCalendar,
  loadRegionCalendar,
  type CalendarCell,
  type CalendarData,
} from '@/lib/calendarData';
import { RAMPS, rampColor, type RampId } from '@/lib/colorRamps';
import { buildHotspotCsv, buildMonthlyCsv, downloadText, exportSlug } from '@/lib/csvExport';
import { cn } from '@/lib/utils';
import { useFilters } from '@/state/filters';
import { ymKey } from '@/state/yearMonth';

type LoadState =
  | { status: 'loading'; progress?: string }
  | { status: 'ready'; data: CalendarData }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

const TONE_CLASS = {
  clear: 'text-[#6ee7b7]',
  advisory: 'text-[#7dd3fc]',
  watch: 'text-[#fcd34d]',
  warning: 'text-[#fdba74]',
  extreme: 'text-[#fca5a5]',
} as const;

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtSigned = (n: number, digits = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}`;

function useCalendar(): LoadState {
  const { aoi, maskStatic, mode } = useFilters();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const variant = maskStatic ? 'masked' : 'unmasked';
    let job: Promise<CalendarData> | null = null;
    if (aoi.kind === 'region') {
      if (!ARCHIVE_REGIONS.has(aoi.regionId)) {
        setState({ status: 'unsupported' });
        return;
      }
      job = loadRegionCalendar(aoi.regionId, variant, mode);
    } else {
      job = loadAoiCalendar(aoi, (done, total) => {
        if (!cancelled) setState({ status: 'loading', progress: `Aggregating hex grid · ${done}/${total} years` });
      });
    }
    setState({ status: 'loading' });
    job
      .then((data) => !cancelled && setState({ status: 'ready', data }))
      .catch((error: unknown) => !cancelled && setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'The archive could not be loaded.',
      }));
    return () => {
      cancelled = true;
    };
  }, [aoi, maskStatic, mode]);

  return state;
}

/** Log scale: fire counts span four orders of magnitude between quiet and El Niño months. */
function makeScale(max: number, ramp: RampId) {
  const top = Math.log1p(Math.max(max, 1));
  return (v: number) => (v <= 0 ? null : rampColor(ramp, 0.08 + 0.92 * (Math.log1p(v) / top)));
}

function logTicks(max: number): number[] {
  const ticks = [1];
  for (let t = 10; t <= max; t *= 10) ticks.push(t);
  return ticks;
}

function ModeToggle() {
  const { mode, setFilters } = useFilters();
  const options = [
    { value: 'harmonized' as const, label: 'Artemis harmonized' },
    { value: 'raw' as const, label: 'Raw sensor counts' },
  ];
  return (
    <div role="radiogroup" aria-label="Calendar values" className="flex h-8 overflow-hidden rounded-[4px] border border-white/[0.14] bg-[#111111]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          onClick={() => setFilters({ mode: o.value })}
          className={cn(
            'border-r border-white/[0.08] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors last:border-r-0',
            mode === o.value ? 'bg-white/[0.09] text-white' : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Tooltip({ cell, mode, x, y, flip }: { cell: CalendarCell; mode: 'harmonized' | 'raw'; x: number; y: number; flip: boolean }) {
  const r = cell.record;
  const anomaly = describeAnomaly(cell.z);
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 w-60 rounded-[4px] border border-white/[0.14] bg-[#111111]/95 p-3 shadow-[0_16px_32px_rgba(0,0,0,0.45)] backdrop-blur-md"
      style={{ left: x, top: y, transform: flip ? 'translate(-100%, -100%)' : 'translate(0, -100%)' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
          {MONTH_LABELS[cell.month - 1]} {cell.year}
        </span>
        {cell.coverage < 1 && (
          <span className="font-mono text-[10px] text-white/45">{Math.round(cell.coverage * 100)}% of month</span>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums">
        <dt className={cn('text-white/55', mode === 'harmonized' && 'text-white/85')}>Harmonized</dt>
        <dd className="text-right text-white/90">{fmt(cell.harmonized)}</dd>
        {r && (
          <>
            <dt className={cn('text-white/55', mode === 'raw' && 'text-white/85')}>Raw detections</dt>
            <dd className="text-right text-white/90">{fmt(r.rawPoints)}</dd>
            <dt className="pl-2 text-white/55">MODIS</dt>
            <dd className="text-right text-white/60">{fmt(r.modisPoints)}</dd>
            <dt className="pl-2 text-white/55">VIIRS</dt>
            <dd className="text-right text-white/60">{fmt(r.viirsPoints)}</dd>
            <dt className="text-white/55">FRP (MODIS-eq.)</dt>
            <dd className="text-right text-white/90">{fmt(r.frpHarmonized)} MW</dd>
          </>
        )}
      </dl>
      {cell.z !== null && (
        <div className="mt-2 border-t border-white/[0.08] pt-2 font-mono text-[11px] tabular-nums">
          <span className={TONE_CLASS[anomaly.tone]}>{fmtSigned(cell.z)}σ</span>
          {cell.pct !== null && <span className="text-white/60"> · {fmtSigned(cell.pct, 0)}% vs median</span>}
          <div className="mt-0.5 text-[10px] text-white/45">{anomaly.label}{cell.coverage < 1 ? ' (projected)' : ''}</div>
        </div>
      )}
    </div>
  );
}

function AnomalyPanel({ data, cell }: { data: CalendarData; cell: CalendarCell }) {
  const base = data.baseline[cell.month];
  const anomaly = describeAnomaly(cell.z);
  const Icon = cell.z !== null && cell.z >= 1.5 ? AlertTriangle : cell.z !== null && cell.z >= 0.5 ? TrendingUp : cell.z !== null && cell.z < -0.5 ? TrendingDown : Eye;
  const partial = cell.coverage < 1;
  return (
    <div className="rounded-[4px] border border-white/[0.12] bg-[#111111] p-4">
      <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/85">
        {MONTH_LABELS[cell.month - 1]} {cell.year} vs 20-year median
      </h3>
      <div className="mt-3 flex items-baseline gap-3 font-mono tabular-nums">
        <span className={cn('text-3xl font-bold', TONE_CLASS[anomaly.tone])}>
          {cell.z === null ? '—' : `${fmtSigned(cell.z)}σ`}
        </span>
        {cell.pct !== null && <span className="text-sm text-white/70">{fmtSigned(cell.pct, 0)}%</span>}
      </div>
      <div className={cn('mt-1 flex items-center gap-1.5 text-xs font-medium', TONE_CLASS[anomaly.tone])}>
        <Icon className="h-3.5 w-3.5" />
        {anomaly.label}
      </div>
      <p className="mt-3 text-xs leading-5 text-white/55">
        {partial ? 'Projected ' : ''}
        <span className="font-mono tabular-nums text-white/80">{fmt(cell.projected)}</span> fire cell-days
        {partial ? ` from the first ${Math.round(cell.coverage * 100)}% of the month` : ''}, against a{' '}
        {MONTH_LABELS[cell.month - 1]} median of <span className="font-mono tabular-nums text-white/80">{fmt(base.median)}</span>{' '}
        (middle half {fmt(base.q25)}–{fmt(base.q75)}) for 2001–2025.
      </p>
    </div>
  );
}

function Legend({ max, ramp, mode }: { max: number; ramp: RampId; mode: 'harmonized' | 'raw' }) {
  const ticks = logTicks(max);
  const top = Math.log1p(Math.max(max, 1));
  return (
    <div className="rounded-[4px] border border-white/[0.12] bg-[#111111] p-4">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/85">
        {mode === 'raw' ? 'Raw detections / month' : 'Fire cell-days / month'}
      </div>
      <div className="mt-1 text-[11px] text-white/45">{RAMPS[ramp].label} · log scale · colorblind-safe</div>
      <div className="relative mt-3 h-3 rounded-[2px]" style={{ background: `linear-gradient(to right, ${Array.from({ length: 12 }, (_, i) => rampColor(ramp, 0.08 + 0.92 * (i / 11))).join(', ')})` }} />
      <div className="relative mt-1 h-4 font-mono text-[10px] tabular-nums text-white/50">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(Math.log1p(t) / top) * 100}%` }}>
            {t >= 1000 ? `${t / 1000}k` : t}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-white/50">
        <span className="h-3 w-3 rounded-[2px] border border-white/[0.12] bg-transparent" /> No detections
        <span className="ml-3 h-3 w-3 rounded-[2px] border border-white/60" /> Selected month
      </div>
    </div>
  );
}

function DownloadButtons({ data }: { data: CalendarData | null }) {
  const { aoi, start, end, maskStatic } = useFilters();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const slug = exportSlug(aoi, start, end);

  const monthly = () => {
    if (!data) return;
    downloadText(`${slug}_monthly-analytics.csv`, buildMonthlyCsv(data, start, end, aoi, maskStatic));
    setNote({ tone: 'ok', text: 'Monthly analytics CSV downloaded.' });
  };

  const hotspots = async () => {
    setBusy('Preparing…');
    setNote(null);
    try {
      const result = await buildHotspotCsv(aoi, start, end, maskStatic, (done, total) => setBusy(`Reading archive ${done}/${total}`));
      if (result.unavailable) {
        setNote({ tone: 'warn', text: result.unavailable });
      } else {
        downloadText(`${slug}_hotspots.csv`, result.csv);
        setNote({ tone: 'ok', text: `${result.count.toLocaleString('en-US')} detections downloaded.` });
      }
    } catch (error) {
      setNote({ tone: 'warn', text: error instanceof Error ? `${error.message} Try again.` : 'Download failed. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const btn = 'flex h-8 items-center gap-1.5 rounded-[4px] border px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Download CSV">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/55">CSV</span>
        <button type="button" onClick={hotspots} disabled={!!busy} className={cn(btn, 'border-accent-500/60 bg-accent-500 text-black hover:bg-accent-400')}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {busy ?? 'Filtered hotspots'}
        </button>
        <button type="button" onClick={monthly} disabled={!data} className={cn(btn, 'border-white/[0.14] text-white/70 hover:border-white/30 hover:text-white')}>
          <Download className="h-3.5 w-3.5" /> Monthly analytics
        </button>
      </div>
      {note && (
        <p role="status" className={cn('max-w-md text-right text-[11px] leading-4', note.tone === 'ok' ? 'text-[#6ee7b7]' : 'text-[#fcd34d]')}>
          {note.text}
        </p>
      )}
    </div>
  );
}

export function BurningCalendar() {
  const state = useCalendar();
  const { aoi, start, end, ramp, mode, maskStatic, focus, setFilters } = useFilters();
  const [hover, setHover] = useState<{ key: string; x: number; y: number; flip: boolean } | null>(null);
  const [view, setView] = useState<'heatmap' | 'table'>('heatmap');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const data = state.status === 'ready' ? state.data : null;
  const effectiveMode = data?.supportsRaw ? mode : 'harmonized';
  const inRange = (y: number, m: number) => ymKey({ year: y, month: m }) >= ymKey(start) && ymKey({ year: y, month: m }) <= ymKey(end);

  const derived = useMemo(() => {
    if (!data) return null;
    let max = 0;
    let latest: CalendarCell | null = null;
    const yearTotals = new Map<number, number>();
    for (const c of data.cells.values()) {
      const v = effectiveMode === 'raw' ? c.record?.rawPoints ?? 0 : c.harmonized;
      if (inRange(c.year, c.month)) {
        max = Math.max(max, v);
        yearTotals.set(c.year, (yearTotals.get(c.year) ?? 0) + v);
      }
      if (!latest || ymKey(c) > ymKey(latest)) latest = c;
    }
    const maxYear = Math.max(1, ...yearTotals.values());
    const peakYear = [...yearTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    const monthMedians = Array.from({ length: 12 }, (_, i) => data.baseline[i + 1]?.median ?? 0);
    const peakMonth = monthMedians.indexOf(Math.max(...monthMedians)) + 1;
    return { max, latest, yearTotals, maxYear, peakYear, monthMedians, peakMonth };
  }, [data, effectiveMode, start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  const scale = useMemo(() => makeScale(derived?.max ?? 1, ramp), [derived?.max, ramp]);
  const valueOf = (c: CalendarCell | undefined) => (!c ? 0 : effectiveMode === 'raw' ? c.record?.rawPoints ?? 0 : c.harmonized);
  const focusKey = focus ? cellKey(focus.year, focus.month) : null;
  const focusCell = data && (focusKey ? data.cells.get(focusKey) : null);
  const anomalyCell = focusCell ?? derived?.latest ?? null;

  const select = (c: CalendarCell) => setFilters({ focus: { year: c.year, month: c.month } });

  const showTip = (key: string, el: HTMLElement) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!wrap) return;
    const x = r.left - wrap.left + r.width / 2;
    setHover({ key, x, y: r.top - wrap.top - 6, flip: x > wrap.width - 250 });
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // Read the focused cell from the DOM: state may lag one render behind the first keypress.
    const currentKey = (e.target as HTMLElement).dataset.key ?? activeKey;
    if (!data || !currentKey) return;
    const [y, m] = currentKey.split('-').map(Number);
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    const mv = moves[e.key];
    if (mv) {
      e.preventDefault();
      let ny = y + mv[0];
      let nm = m + mv[1];
      if (nm < 1) { nm = 12; ny -= 1; }
      if (nm > 12) { nm = 1; ny += 1; }
      const k = cellKey(ny, nm);
      if (data.cells.has(k)) {
        setActiveKey(k);
        const el = gridRef.current?.querySelector<HTMLButtonElement>(`[data-key="${k}"]`);
        el?.focus();
        if (el) showTip(k, el);
      }
    } else if (e.key === 'Escape') {
      setHover(null);
    }
  };

  const areaName = aoiLabel(aoi);

  return (
    <section aria-labelledby="calendar-title" className="terminal-surface rounded-[4px]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#a3a3a3]/15 px-4 py-3">
        <div className="min-w-0">
          <h2 id="calendar-title" className="flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-white/90">
            <CalendarDays className="h-4 w-4 text-white/45" />
            Burning calendar 2000–2026
          </h2>
          <p className="mt-1 font-mono text-[10px] text-white/45">
            {areaName} · {effectiveMode === 'raw' ? 'raw MODIS + VIIRS detections' : 'MODIS-equivalent fire cell-days'} ·{' '}
            {maskStatic || data?.maskFixed ? 'static heat masked' : 'static heat included'}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <DownloadButtons data={data} />
          {data?.supportsRaw && <ModeToggle />}
          <button
            type="button"
            onClick={() => setView(view === 'heatmap' ? 'table' : 'heatmap')}
            className="flex h-8 items-center gap-1.5 rounded-[4px] border border-white/[0.14] px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60 transition-colors hover:border-white/30 hover:text-white"
          >
            {view === 'heatmap' ? <Table2 className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
            {view === 'heatmap' ? 'Table view' : 'Heatmap view'}
          </button>
        </div>
      </header>

      {effectiveMode === 'raw' && (
        <p className="flex items-start gap-2 border-b border-white/[0.08] bg-[#fcd34d]/[0.05] px-4 py-2 text-xs leading-5 text-white/70">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#fcd34d]" />
          Raw counts add every sensor's detections. The jumps in 2012 (Suomi-NPP VIIRS) and 2018 (NOAA-20 VIIRS) come
          from new, finer 375 m sensors, not more fire. Switch to Artemis harmonized for comparisons across years.
        </p>
      )}
      {data && !data.supportsRaw && (
        <p className="flex items-start gap-2 border-b border-white/[0.08] px-4 py-2 text-xs leading-5 text-white/55">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
          Custom areas are summed from the harmonized H3 hex grid (~5 km² cells; static heat always masked). Raw per-sensor counts
          are available for Indonesia and the five fire provinces.
        </p>
      )}

      {state.status === 'loading' && (
        <div className="flex h-72 flex-col items-center justify-center gap-2 text-sm text-white/50">
          <Flame className="h-5 w-5 animate-pulse text-white/30" />
          {state.progress ?? 'Loading the 20-year harmonized archive…'}
        </div>
      )}
      {state.status === 'error' && (
        <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-[#fca5a5]">
          {state.message} Reload the page to try again.
        </div>
      )}
      {state.status === 'unsupported' && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="max-w-lg text-sm leading-6 text-white/60">
            The 20-year harmonized archive covers Indonesia. Choose Indonesia or one of the five fire provinces,
            or draw a polygon or set a point inside Indonesia.
          </p>
          <button
            type="button"
            onClick={() => setFilters({ aoi: { kind: 'region', regionId: 'indonesia' } })}
            className="mt-1 rounded-[6px] border border-white/[0.16] px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/70 hover:border-white/30 hover:text-white"
          >
            Show Indonesia
          </button>
        </div>
      )}

      {data && derived && (
        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <div ref={wrapRef} className="relative min-w-0">
            {view === 'heatmap' ? (
              <div className="overflow-x-auto pb-1">
                <div
                  ref={gridRef}
                  role="grid"
                  aria-label={`Burning calendar for ${areaName}`}
                  onKeyDown={onGridKey}
                  onMouseLeave={() => setHover(null)}
                  className="grid min-w-[640px] gap-[2px] font-mono text-[10px] tabular-nums"
                  style={{ gridTemplateColumns: '2.75rem repeat(12, minmax(1.5rem, 1fr)) 7.5rem' }}
                >
                  <div />
                  {MONTH_LABELS.map((m, i) => (
                    <div key={m} className={cn('pb-1 text-center text-white/45', derived.peakMonth === i + 1 && 'text-white/80')}>{m}</div>
                  ))}
                  <div className="pb-1 pl-2 text-white/45">Year total</div>

                  {data.years.map((year) => {
                    const total = derived.yearTotals.get(year) ?? 0;
                    const isPeak = derived.peakYear?.[0] === year;
                    return (
                      <div key={year} role="row" className="contents">
                        <div className={cn('flex items-center pr-1 text-white/50', isPeak && 'text-white')}>{year}</div>
                        {Array.from({ length: 12 }, (_, i) => {
                          const m = i + 1;
                          const key = cellKey(year, m);
                          const c = data.cells.get(key);
                          if (!c) return <div key={key} aria-hidden className="h-[18px]" />;
                          const v = valueOf(c);
                          const color = scale(v);
                          const selected = key === focusKey;
                          const defaultKey = derived.latest ? cellKey(derived.latest.year, derived.latest.month) : null;
                          const active = (activeKey ?? defaultKey) === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              role="gridcell"
                              data-key={key}
                              tabIndex={active ? 0 : -1}
                              aria-selected={selected}
                              aria-label={`${MONTH_LABELS[i]} ${year}: ${fmt(v)} ${effectiveMode === 'raw' ? 'detections' : 'fire cell-days'}${c.z !== null ? `, ${fmtSigned(c.z)} sigma` : ''}`}
                              onClick={() => select(c)}
                              onMouseEnter={(e) => showTip(key, e.currentTarget)}
                              onFocus={(e) => { setActiveKey(key); showTip(key, e.currentTarget); }}
                              onBlur={() => setHover(null)}
                              className={cn(
                                'relative h-[18px] rounded-[2px] transition-[opacity,box-shadow] focus-visible:outline-offset-1',
                                !color && 'border border-white/[0.08]',
                                !inRange(year, m) && 'opacity-20',
                                selected && 'ring-2 ring-white ring-offset-1 ring-offset-[#0b0b0b]',
                              )}
                              style={color ? { backgroundColor: color } : undefined}
                            >
                              {c.coverage < 1 && <span aria-hidden className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-white" />}
                            </button>
                          );
                        })}
                        <div className="flex items-center gap-2 pl-2">
                          <div className="h-[6px] flex-1 overflow-hidden rounded-[1px] bg-white/[0.04]">
                            <div className="h-full rounded-[1px] bg-white/45" style={{ width: `${(total / derived.maxYear) * 100}%` }} />
                          </div>
                          <span className={cn('w-12 text-right text-white/45', isPeak && 'text-white/90')}>
                            {total >= 1e6 ? `${(total / 1e6).toFixed(1)}M` : total >= 1e3 ? `${Math.round(total / 1e3)}k` : fmt(total)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center border-t border-white/[0.1] pt-1.5 text-white/60">Median</div>
                  {derived.monthMedians.map((med, i) => {
                    const color = effectiveMode === 'harmonized' ? scale(med) : null;
                    return (
                      <div key={i} className="border-t border-white/[0.1] pt-1.5">
                        <div
                          className={cn('h-[18px] rounded-[2px]', !color && 'border border-white/[0.08]')}
                          style={color ? { backgroundColor: color } : undefined}
                          title={`${MONTH_LABELS[i]} median 2001–2025: ${fmt(med)} fire cell-days`}
                        />
                      </div>
                    );
                  })}
                  <div className="flex items-center border-t border-white/[0.1] pl-2 pt-1.5 text-white/45">2001–2025</div>
                </div>
              </div>
            ) : (
              <div className="max-h-[34rem] overflow-auto">
                <table className="w-full min-w-[720px] border-collapse font-mono text-[11px] tabular-nums">
                  <caption className="sr-only">Monthly {effectiveMode === 'raw' ? 'raw detections' : 'harmonized fire cell-days'} for {areaName}</caption>
                  <thead className="sticky top-0 bg-[#0b0b0b]">
                    <tr>
                      <th scope="col" className="px-2 py-1.5 text-left font-semibold text-white/55">Year</th>
                      {MONTH_LABELS.map((m) => <th key={m} scope="col" className="px-2 py-1.5 text-right font-semibold text-white/55">{m}</th>)}
                      <th scope="col" className="px-2 py-1.5 text-right font-semibold text-white/55">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.years.map((year) => (
                      <tr key={year} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
                        <th scope="row" className="px-2 py-1 text-left font-medium text-white/70">{year}</th>
                        {Array.from({ length: 12 }, (_, i) => {
                          const c = data.cells.get(cellKey(year, i + 1));
                          return (
                            <td key={i} className={cn('px-2 py-1 text-right text-white/75', c && !inRange(year, i + 1) && 'text-white/45')}>
                              {c ? fmt(valueOf(c)) : ''}
                            </td>
                          );
                        })}
                        <td className="px-2 py-1 text-right text-white/90">{fmt(derived.yearTotals.get(year) ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {view === 'heatmap' && hover && data.cells.get(hover.key) && (
              <Tooltip cell={data.cells.get(hover.key)!} mode={effectiveMode} x={hover.x} y={hover.y} flip={hover.flip} />
            )}
            <p className="mt-2 text-[11px] leading-5 text-white/45">
              Click a month to show it on the map. Arrow keys move between months. Dimmed months fall outside the selected
              period; a white dot marks the current, partial month.
            </p>
          </div>

          <aside className="flex flex-col gap-3">
            {anomalyCell && <AnomalyPanel data={data} cell={anomalyCell} />}
            <Legend max={derived.max} ramp={ramp} mode={effectiveMode} />
            {derived.peakYear && (
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-white/[0.12] bg-white/[0.08] font-mono text-[11px]">
                <div className="bg-[#111111] p-3">
                  <dt className="text-[10px] uppercase tracking-[0.1em] text-white/45">Peak year</dt>
                  <dd className="mt-1 text-base font-bold tabular-nums text-white">{derived.peakYear[0]}</dd>
                </div>
                <div className="bg-[#111111] p-3">
                  <dt className="text-[10px] uppercase tracking-[0.1em] text-white/45">Peak month</dt>
                  <dd className="mt-1 text-base font-bold text-white">{MONTH_LABELS[derived.peakMonth - 1]}</dd>
                </div>
              </dl>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
