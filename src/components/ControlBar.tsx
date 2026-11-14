import { useEffect, useId, useState, type ReactNode } from 'react';
import { Check, Crosshair, MapPin, PenLine, RotateCcw, X } from 'lucide-react';

import { REGIONS } from '@/data/regions';
import { MONTH_LABELS } from '@/data/historyApi';
import { aoiLabel, type Aoi } from '@/lib/aoi';
import { RAMPS, RAMP_IDS, rampGradient } from '@/lib/colorRamps';
import { cn } from '@/lib/utils';
import { useFilters } from '@/state/filters';
import { ARCHIVE_START, clampYm, currentYearMonth, ymKey, type YearMonth } from '@/state/yearMonth';

const REGION_GROUPS: { scope: (typeof REGIONS)[number]['scope']; label: string }[] = [
  { scope: 'province', label: 'Indonesia · fire provinces' },
  { scope: 'country', label: 'Countries' },
  { scope: 'continent', label: 'Continents' },
  { scope: 'world', label: 'World' },
];

const fieldClass =
  'h-8 rounded-[4px] border border-white/[0.14] bg-[#111111] px-2 font-mono text-[11px] text-white/85 transition-colors hover:border-white/25 focus-visible:border-accent-500/70';

function Group({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="terminal-label text-[10px] font-semibold text-white/45">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Segment<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-8 overflow-hidden rounded-[4px] border border-white/[0.14] bg-[#111111]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex items-center gap-1.5 border-r border-white/[0.08] px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors last:border-r-0',
            value === option.value ? 'bg-white/[0.09] text-white' : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MonthPicker({ value, onChange, label }: { value: YearMonth; onChange: (ym: YearMonth) => void; label: string }) {
  const max = currentYearMonth();
  const years = Array.from({ length: max.year - ARCHIVE_START.year + 1 }, (_, i) => ARCHIVE_START.year + i);
  return (
    <span className="flex items-center gap-1">
      <select
        aria-label={`${label} month`}
        value={value.month}
        onChange={(e) => {
          // Keep the chosen month; move the year if that month falls outside the archive.
          const month = Number(e.target.value);
          let year = value.year;
          if (ymKey({ year, month }) < ymKey(ARCHIVE_START)) year += 1;
          if (ymKey({ year, month }) > ymKey(max)) year -= 1;
          onChange(clampYm({ year, month }));
        }}
        className={fieldClass}
      >
        {MONTH_LABELS.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <select
        aria-label={`${label} year`}
        value={value.year}
        onChange={(e) => onChange(clampYm({ year: Number(e.target.value), month: value.month }))}
        className={fieldClass}
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </span>
  );
}

function ActionButton({ onClick, children, active, title }: { onClick: () => void; children: ReactNode; active?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-[4px] border px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors',
        active
          ? 'border-accent-500/60 bg-accent-500/15 text-accent-200'
          : 'border-white/[0.14] text-white/60 hover:border-white/30 hover:text-white',
      )}
    >
      {children}
    </button>
  );
}

function PointFields({ aoi }: { aoi: Aoi }) {
  const { setFilters, drawMode, setDrawMode } = useFilters();
  const current = aoi.kind === 'point' ? aoi : null;
  const [lat, setLat] = useState(current ? String(current.lat) : '');
  const [lng, setLng] = useState(current ? String(current.lng) : '');
  const [radius, setRadius] = useState(current ? String(current.radiusKm) : '25');
  const ids = useId();

  // Picking on the map updates the URL; mirror it into the inputs.
  useEffect(() => {
    if (!current) return;
    setLat(current.lat.toFixed(4));
    setLng(current.lng.toFixed(4));
    setRadius(String(current.radiusKm));
  }, [current?.lat, current?.lng, current?.radiusKm]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = { lat: Number(lat), lng: Number(lng), r: Number(radius) };
  const valid =
    lat !== '' && lng !== '' &&
    Number.isFinite(parsed.lat) && Math.abs(parsed.lat) <= 90 &&
    Number.isFinite(parsed.lng) && Math.abs(parsed.lng) <= 180 &&
    Number.isFinite(parsed.r) && parsed.r > 0 && parsed.r <= 500;

  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) setFilters({ aoi: { kind: 'point', lat: parsed.lat, lng: parsed.lng, radiusKm: parsed.r } });
      }}
    >
      <input id={`${ids}-lat`} aria-label="Latitude" placeholder="Lat −0.50" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} className={cn(fieldClass, 'w-24')} />
      <input aria-label="Longitude" placeholder="Lng 101.40" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} className={cn(fieldClass, 'w-24')} />
      <span className="flex items-center gap-1">
        <input aria-label="Radius in kilometres" inputMode="decimal" value={radius} onChange={(e) => setRadius(e.target.value)} className={cn(fieldClass, 'w-14 text-right')} />
        <span className="font-mono text-[10px] text-white/45">km</span>
      </span>
      <ActionButton onClick={() => valid && setFilters({ aoi: { kind: 'point', lat: parsed.lat, lng: parsed.lng, radiusKm: parsed.r } })} title="Apply coordinates">
        <Check className="h-3.5 w-3.5" /> Apply
      </ActionButton>
      <ActionButton onClick={() => setDrawMode(drawMode === 'point' ? 'none' : 'point')} active={drawMode === 'point'} title="Click the map to set the centre">
        <Crosshair className="h-3.5 w-3.5" /> Pick on map
      </ActionButton>
      <button type="submit" hidden />
    </form>
  );
}

function PolygonFields({ aoi }: { aoi: Aoi }) {
  const { setFilters, drawMode, setDrawMode } = useFilters();
  const drawing = drawMode === 'polygon';
  const hasPolygon = aoi.kind === 'polygon';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ActionButton onClick={() => setDrawMode(drawing ? 'none' : 'polygon')} active={drawing}>
        {drawing ? <X className="h-3.5 w-3.5" /> : <PenLine className="h-3.5 w-3.5" />}
        {drawing ? 'Cancel drawing' : hasPolygon ? 'Redraw' : 'Draw on map'}
      </ActionButton>
      {hasPolygon && !drawing && (
        <ActionButton onClick={() => setFilters({ aoi: { kind: 'region', regionId: 'indonesia' } })}>
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </ActionButton>
      )}
      <span className="font-mono text-[10px] text-white/45">
        {drawing ? 'Click to add points · double-click or click the first point to finish · Esc cancels' : hasPolygon ? aoiLabel(aoi) : 'No area drawn yet'}
      </span>
    </div>
  );
}

export function ControlBar() {
  const { aoi, start, end, ramp, maskStatic, setFilters, setDrawMode } = useFilters();
  const [mode, setMode] = useState<Aoi['kind']>(aoi.kind);
  const ids = useId();

  useEffect(() => setMode(aoi.kind), [aoi.kind]);

  const changeMode = (next: Aoi['kind']) => {
    setMode(next);
    setDrawMode(next === 'polygon' && aoi.kind !== 'polygon' ? 'polygon' : 'none');
    if (next === 'region' && aoi.kind !== 'region') setFilters({ aoi: { kind: 'region', regionId: 'indonesia' } });
  };

  const setRange = (s: YearMonth, e: YearMonth) => {
    if (ymKey(s) > ymKey(e)) [s, e] = [e, s];
    setFilters({ start: s, end: e });
  };
  const now = currentYearMonth();

  return (
    <section
      aria-label="Dashboard filters"
      className="relative z-30 border-b border-white/[0.1] bg-[#0c0c0c]/95 backdrop-blur-xl lg:sticky lg:top-[65px]"
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-end gap-x-6 gap-y-3 px-3 py-3 sm:px-6">
        <Group label="Area of interest" htmlFor={`${ids}-region`} className="min-w-[16rem] flex-1">
          <Segment
            label="Area type"
            value={mode}
            onChange={changeMode}
            options={[
              { value: 'region', label: 'Region', icon: <MapPin className="h-3 w-3" /> },
              { value: 'point', label: 'Lat / Long', icon: <Crosshair className="h-3 w-3" /> },
              { value: 'polygon', label: 'Polygon', icon: <PenLine className="h-3 w-3" /> },
            ]}
          />
          {mode === 'region' && (
            <select
              id={`${ids}-region`}
              value={aoi.kind === 'region' ? aoi.regionId : ''}
              onChange={(e) => setFilters({ aoi: { kind: 'region', regionId: e.target.value } })}
              className={cn(fieldClass, 'min-w-[12rem]')}
            >
              {REGION_GROUPS.map((group) => (
                <optgroup key={group.scope} label={group.label}>
                  {REGIONS.filter((r) => r.scope === group.scope).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
          {mode === 'point' && <PointFields aoi={aoi} />}
          {mode === 'polygon' && <PolygonFields aoi={aoi} />}
        </Group>

        <Group label="Period">
          <MonthPicker label="From" value={start} onChange={(s) => setRange(s, end)} />
          <span className="font-mono text-[10px] text-white/55">to</span>
          <MonthPicker label="To" value={end} onChange={(e) => setRange(start, e)} />
          <ActionButton onClick={() => setRange(ARCHIVE_START, now)} active={ymKey(start) === ymKey(ARCHIVE_START) && ymKey(end) === ymKey(now)}>
            All
          </ActionButton>
          <ActionButton
            onClick={() => setRange({ year: now.year - 5, month: now.month }, now)}
            active={ymKey(start) === ymKey({ year: now.year - 5, month: now.month }) && ymKey(end) === ymKey(now)}
          >
            5 yr
          </ActionButton>
        </Group>

        <Group label="Color ramp · colorblind-safe">
          <div role="radiogroup" aria-label="Color ramp" className="flex gap-1.5">
            {RAMP_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={ramp === id}
                onClick={() => setFilters({ ramp: id })}
                className={cn(
                  'flex h-8 items-center gap-2 rounded-[4px] border px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors',
                  ramp === id ? 'border-white/40 bg-white/[0.07] text-white' : 'border-white/[0.14] text-white/50 hover:border-white/30 hover:text-white/80',
                )}
              >
                <span aria-hidden className="h-2.5 w-8 rounded-[2px]" style={{ background: rampGradient(id) }} />
                {RAMPS[id].label}
              </button>
            ))}
          </div>
        </Group>

        <label className="flex h-8 cursor-pointer items-center gap-2 self-end rounded-[4px] border border-white/[0.14] bg-[#111111] px-2.5 transition-colors hover:border-white/30">
          <input
            type="checkbox"
            aria-label="Mask static industrial and volcanic heat sources"
            checked={maskStatic}
            onChange={(e) => setFilters({ maskStatic: e.target.checked })}
            className="h-3.5 w-3.5 accent-[#d9831c]"
          />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/70">
            Mask static industrial &amp; volcanic heat
          </span>
        </label>
      </div>
    </section>
  );
}
