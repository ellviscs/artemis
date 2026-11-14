import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';

import { MONTH_LABELS } from '@/data/historyApi';
import { cn } from '@/lib/utils';
import type { FireHotspot } from '@/types';
import type { InspectTarget } from '@/components/HotspotInspector';
import { useHubContext } from './hubContext';
import { EscrowTab } from './EscrowTab';
import { GroundTruthTab } from './GroundTruthTab';
import { HazeShieldTab, type HazeCone } from './HazeShieldTab';
import { WatchdogTab } from './WatchdogTab';

export type HubTab = 'escrow' | 'ground' | 'haze' | 'watchdog';

const TABS: { id: HubTab; num: string; label: string; short: string }[] = [
  { id: 'escrow', num: '01', label: 'Satellite escrow', short: 'Escrow' },
  { id: 'ground', num: '02', label: 'Citizen ground-truth', short: 'Ground-truth' },
  { id: 'haze', num: '03', label: 'Downwind haze shield', short: 'Haze' },
  { id: 'watchdog', num: '04', label: 'Civic watchdog & P2P', short: 'Watchdog' },
];

interface Props {
  target: InspectTarget;
  /** Live detections for the current day, used for nearby-detection lists. */
  liveHotspots: FireHotspot[];
  variant: 'modal' | 'page';
  initialTab?: HubTab;
  onClose?: () => void;
  /** Dashboard only: draw the haze cone on the main map (the dashboard closes the hub). */
  onShowCone?: (cone: HazeCone) => void;
  /** Dashboard only: fly the main map to a donation campaign. */
  onViewLocation?: (lat: number, lng: number, zoom: number) => void;
}

function Chip({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-[#0f0f0f] px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/55">{label}</dt>
      <dd className={cn('mt-0.5 font-mono text-[13px] tabular-nums text-white/90', tone)}>{value}</dd>
    </div>
  );
}

export function ImpactHub({ target, liveHotspots, variant, initialTab = 'escrow', onClose, onShowCone, onViewLocation }: Props) {
  const ctx = useHubContext(target);
  const [tab, setTab] = useState<HubTab>(initialTab);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabRefs = useRef<Record<HubTab, HTMLButtonElement | null>>({ escrow: null, ground: null, haze: null, watchdog: null });

  useEffect(() => {
    headingRef.current?.focus();
    if (!onClose) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  };

  const f = ctx.forensic.data;
  const z = ctx.monthRecord?.z ?? null;
  const live = target.live;
  const permalink = `/impact?lat=${target.lat.toFixed(4)}&lng=${target.lng.toFixed(4)}${target.archive ? `&month=${target.archive.year}-${String(target.archive.month).padStart(2, '0')}` : ''}`;

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-[#a3a3a3]/15 px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Impact hub</p>
            <h2 id="impact-title" ref={headingRef} tabIndex={-1} className="mt-1 truncate text-base font-semibold text-white outline-none sm:text-lg">
              {ctx.place ?? 'Locating…'}
            </h2>
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-white/55">
              {target.lat.toFixed(4)}, {target.lng.toFixed(4)}
              {ctx.place?.includes(ctx.calendarRegion.name) ? '' : ` · ${ctx.calendarRegion.name}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {variant === 'modal' && (
              <Link to={permalink} className="hidden items-center gap-1 rounded-[4px] px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/60 hover:bg-white/[0.06] hover:text-white sm:flex">
                Open as page <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            {onClose && (
              <button type="button" onClick={onClose} aria-label="Close impact hub" className="rounded-[4px] p-1.5 text-white/60 hover:bg-white/[0.06] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-white/[0.12] bg-white/[0.08] sm:grid-cols-4">
          <Chip label={live ? 'Live FRP' : 'Archive cell-days'} value={live ? `${live.frp.toFixed(1)} MW` : target.archive?.value ? target.archive.value.toFixed(1) : '—'} />
          <Chip
            label={`Anomaly · ${MONTH_LABELS[ctx.month.month - 1]} ${ctx.month.year}`}
            value={z === null ? (ctx.months.length ? 'no spread' : '…') : `${z >= 0 ? '+' : ''}${z.toFixed(2)} σ`}
            tone={z !== null && z >= 1.5 ? 'text-[#fca5a5]' : undefined}
          />
          <Chip label="Signature score" value={f ? `${Math.round(f.score)} / 100` : ctx.forensic.status === 'loading' ? '…' : 'n/a'} />
          <Chip label="National percentile" value={f ? `p${Math.round(f.percentile)}` : ctx.forensic.status === 'loading' ? '…' : 'n/a'} tone={f && f.percentile >= 90 ? 'text-[#fca5a5]' : undefined} />
        </dl>
        <p className="mt-2 text-[11px] leading-4 text-white/55">
          Anomaly = (month − median) / IQR for {ctx.calendarRegion.name}, 2001–2025 baseline. Signature is a rule-based anthropogenic thermal signature score, not a probability.
        </p>
      </header>

      <div role="tablist" aria-label="Impact branches" className="flex gap-px overflow-x-auto border-b border-white/[0.1] bg-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => (tabRefs.current[t.id] = el)}
            id={`hub-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`hub-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={onTabKey}
            className={cn(
              'flex min-w-0 flex-1 items-baseline gap-2 whitespace-nowrap px-3 py-2.5 text-left font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
              tab === t.id ? 'bg-[#0b0b0b] text-white shadow-[inset_0_-2px_0_#d9831c]' : 'bg-[#080808] text-white/60 hover:text-white/85',
            )}
          >
            <span className={tab === t.id ? 'text-accent-300' : 'text-white/45'}>{t.num}</span>
            <span className="hidden md:inline">{t.label}</span>
            <span className="md:hidden">{t.short}</span>
          </button>
        ))}
      </div>

      <div key={tab} id={`hub-panel-${tab}`} role="tabpanel" aria-labelledby={`hub-tab-${tab}`} className="tab-panel-in min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {tab === 'escrow' && <EscrowTab ctx={ctx} onViewLocation={onViewLocation} />}
        {tab === 'ground' && <GroundTruthTab ctx={ctx} />}
        {tab === 'haze' && <HazeShieldTab ctx={ctx} onShowCone={onShowCone} />}
        {tab === 'watchdog' && <WatchdogTab ctx={ctx} liveHotspots={liveHotspots} />}
      </div>
    </div>
  );

  if (variant === 'page') return <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-[#0b0b0b]">{body}</div>;

  return (
    <div className="fixed inset-0 z-[1600] flex items-stretch justify-center bg-black/70 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" aria-labelledby="impact-title" className="flex h-full w-full max-w-5xl flex-col overflow-hidden border border-white/[0.14] bg-[#0b0b0b] shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:h-[88vh] sm:rounded-[6px]">
        {body}
      </div>
    </div>
  );
}
