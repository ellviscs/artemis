import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, CircleDot, Satellite } from 'lucide-react';

import { DonationWidget } from '@/components/DonationWidget';
import { MONTH_LABELS } from '@/data/historyApi';
import { formatCountdown, predictNextPasses, SWATH_EDGE_ELEVATION_DEG, type PassPrediction } from '@/data/passApi';
import { readLocal, writeLocal } from '@/lib/localStore';
import { cn } from '@/lib/utils';
import type { HubContext } from './hubContext';
import { btnGhost, btnPrimary, Hint, LiveTag, Panel, SimTag } from './shared';

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const TRIGGER_Z = 1.5;
const LEAD_DAYS = 21;

interface Pledge {
  at: string;
  amount: number;
  kind: 'retainer' | 'csr';
}

const fmtTime = (d: Date) => `${d.toISOString().slice(11, 16)} UTC`;

function OverpassPanel({ lat, lng }: { lat: number; lng: number }) {
  const [passes, setPasses] = useState<PassPrediction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    predictNextPasses(lat, lng)
      .then((p) => !cancelled && setPasses(p))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Orbit data unavailable.'));
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Recompute once the soonest pass has ended; one request at a time.
  const refreshing = useRef(false);
  useEffect(() => {
    if (refreshing.current || !passes?.[0] || passes[0].end.getTime() >= now) return;
    refreshing.current = true;
    predictNextPasses(lat, lng)
      .then(setPasses)
      .catch(() => undefined)
      .finally(() => {
        refreshing.current = false;
      });
  }, [now, passes, lat, lng]);

  return (
    <Panel title="Next VIIRS overpass" tag={<LiveTag>Real orbit · SGP4</LiveTag>}>
      {error && <p className="text-sm text-[#fca5a5]">Could not compute passes: {error}</p>}
      {!passes && !error && <p className="text-sm text-white/55">Propagating NOAA-20 and NOAA-21 orbits…</p>}
      {passes && passes.length === 0 && <p className="text-sm text-white/60">No pass above {SWATH_EDGE_ELEVATION_DEG}° in the next 36 hours.</p>}
      {passes && passes.length > 0 && (
        <ul className="grid gap-px overflow-hidden rounded-[4px] border border-white/[0.1] bg-white/[0.08] sm:grid-cols-2">
          {passes.map((p, i) => {
            const toPeak = p.peak.getTime() - now;
            const inPass = p.start.getTime() <= now && p.end.getTime() >= now;
            return (
              <li key={p.satellite} className="bg-[#0d0d0d] px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/85">
                    <Satellite className="h-3.5 w-3.5 text-white/60" /> {p.satellite}
                  </span>
                  {i === 0 && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/75">Soonest</span>}
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white" aria-live={i === 0 ? 'off' : undefined}>
                  {inPass ? 'Overhead now' : formatCountdown(toPeak)}
                </p>
                <p className="mt-1 font-mono text-[11px] tabular-nums text-white/60">
                  Peak {fmtTime(p.peak)} · {Math.round(p.maxElevationDeg)}° elev · {p.dayNight === 'N' ? 'night' : 'day'} pass
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {passes && passes[0] && (
        <p className="mt-2 text-[11px] leading-4 text-white/55">
          CelesTrak element sets (epoch {passes[0].tleEpoch.toISOString().slice(0, 10)}). A pass counts when the satellite rises above {SWATH_EDGE_ELEVATION_DEG}°, roughly the edge of the 3,040 km VIIRS swath. Night passes see smouldering peat best.
        </p>
      )}
    </Panel>
  );
}

function Step({ state, title, children }: { state: 'done' | 'active' | 'pending'; title: string; children: React.ReactNode }) {
  const Icon = state === 'done' ? CheckCircle2 : state === 'active' ? CircleDot : Circle;
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', state === 'done' ? 'text-[#6ee7b7]' : state === 'active' ? 'text-accent-300' : 'text-white/45')} />
      <div className="min-w-0">
        <p className={cn('text-[13px] font-semibold', state === 'pending' ? 'text-white/60' : 'text-white/90')}>{title}</p>
        <div className="mt-1 text-[12px] leading-5 text-white/60">{children}</div>
      </div>
    </li>
  );
}

function PreIgnitionPanel({ ctx }: { ctx: HubContext }) {
  const info = useMemo(() => {
    if (!ctx.baseline) return null;
    const medians = Array.from({ length: 12 }, (_, i) => ctx.baseline?.[String(i + 1)]?.median ?? 0);
    const ranked = medians.map((v, i) => ({ month: i + 1, v })).sort((a, b) => b.v - a.v);
    const peak = new Set(ranked.slice(0, 3).filter((r) => r.v > 0).map((r) => r.month));
    const ahead = new Date(Date.now() + LEAD_DAYS * 86_400_000);
    const nowMonth = new Date().getUTCMonth() + 1;
    return { peak, aheadMonth: ahead.getUTCMonth() + 1, entering: !peak.has(nowMonth) && peak.has(ahead.getUTCMonth() + 1), inPeak: peak.has(nowMonth) };
  }, [ctx.baseline]);
  const z = ctx.monthRecord?.z ?? null;
  const triggered = z !== null && z >= TRIGGER_Z;

  return (
    <Panel title="Pre-ignition parametric pool" tag={<LiveTag>Archive 2001–2025</LiveTag>}>
      {!info ? (
        <p className="text-sm text-white/55">Reading the {ctx.calendarRegion.name} calendar…</p>
      ) : (
        <>
          <div className="flex gap-1" role="img" aria-label={`Peak fire months in ${ctx.calendarRegion.name}: ${[...info.peak].map((m) => MONTH_LABELS[m - 1]).join(', ')}`}>
            {MONTH_LABELS.map((label, i) => (
              <div key={label} className="flex-1 text-center">
                <div className={cn('h-2 rounded-[1px]', info.peak.has(i + 1) ? 'bg-[#fdba74]' : 'bg-white/[0.08]', i + 1 === info.aheadMonth && 'outline outline-1 outline-offset-1 outline-white/60')} />
                <span className="mt-1 block font-mono text-[9px] text-white/55">{label[0]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-5 text-white/65">
            Peak months by 25-year median: <strong className="text-white/85">{[...info.peak].map((m) => MONTH_LABELS[m - 1]).join(', ')}</strong>.{' '}
            {info.entering
              ? `${ctx.calendarRegion.name} enters its peak window within ${LEAD_DAYS} days: prevention funds (canal blocking, school masks) should be released now.`
              : info.inPeak
                ? 'The region is inside its peak window now.'
                : `No peak window in the next ${LEAD_DAYS} days.`}
          </p>
          <p className={cn('mt-2 rounded-[4px] border px-3 py-2 text-[12px] leading-5', triggered ? 'border-[#fca5a5]/30 bg-[#fca5a5]/[0.06] text-white/80' : 'border-white/[0.1] text-white/65')}>
            Parametric trigger (anomaly ≥ +{TRIGGER_Z}σ): <strong className={triggered ? 'text-[#fca5a5]' : 'text-white/85'}>{triggered ? 'met' : 'not met'}</strong>
            {z !== null && ` · ${MONTH_LABELS[ctx.month.month - 1]} ${ctx.month.year} is at ${z >= 0 ? '+' : ''}${z.toFixed(2)}σ`}
            {ctx.monthRecord && ctx.monthRecord.coverage < 1 && ` (month ${Math.round(ctx.monthRecord.coverage * 100)}% observed, projected)`}.
          </p>
        </>
      )}
    </Panel>
  );
}

function PledgeFlow({ poolKey, onPledged }: { poolKey: string; onPledged: () => void }) {
  const [kind, setKind] = useState<Pledge['kind']>('retainer');
  const [amount, setAmount] = useState(100_000);
  const [stage, setStage] = useState<'choose' | 'code' | 'done'>('choose');
  const presets = kind === 'retainer' ? [50_000, 100_000, 500_000] : [10_000_000, 50_000_000, 250_000_000];

  const confirm = () => {
    const pledges = readLocal<Pledge[]>(poolKey, []);
    writeLocal(poolKey, [...pledges, { at: new Date().toISOString(), amount, kind }]);
    setStage('done');
    onPledged();
  };

  return (
    <Panel title="QRIS / CSR pledge" tag={<SimTag />}>
      <Hint>
        A walkthrough of how pledges would fund the regional pool. No payment is made and no real QRIS code is produced.
      </Hint>
      <fieldset className="mt-3">
        <legend className="sr-only">Pledge type</legend>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-white/[0.12] bg-white/[0.08]">
          {(['retainer', 'csr'] as const).map((k) => (
            <label key={k} className={cn('cursor-pointer px-3 py-2 text-[12px]', kind === k ? 'bg-[#1a1a1a] text-white' : 'bg-[#0d0d0d] text-white/65')}>
              <input type="radio" name="pledge-kind" className="sr-only" checked={kind === k} onChange={() => { setKind(k); setAmount(k === 'retainer' ? 100_000 : 50_000_000); setStage('choose'); }} />
              <span className="font-semibold">{k === 'retainer' ? 'Zero-Burn Prevention Retainer' : 'CSR protection pool'}</span>
              <span className="mt-0.5 block text-[11px] text-white/55">{k === 'retainer' ? 'Individual · QRIS' : 'Company · virtual account'}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Amount">
        {presets.map((p) => (
          <button key={p} type="button" aria-pressed={amount === p} onClick={() => { setAmount(p); setStage('choose'); }} className={cn(btnGhost, amount === p && 'border-accent-400/60 text-accent-200')}>
            {idr.format(p)}
          </button>
        ))}
      </div>
      {stage === 'choose' && (
        <button type="button" className={cn(btnPrimary, 'mt-3')} onClick={() => setStage('code')}>
          Generate demo payment code
        </button>
      )}
      {stage === 'code' && (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative grid h-32 w-32 shrink-0 grid-cols-8 gap-[2px] overflow-hidden rounded-[4px] border border-white/[0.14] bg-white/[0.04] p-2" aria-label="Placeholder pattern, not a payment code" role="img">
            {Array.from({ length: 64 }, (_, i) => (
              <span key={i} className={((i * 37 + amount / 1000) % 5) < 2 ? 'bg-white/35' : 'bg-transparent'} />
            ))}
            <span className="absolute inset-0 flex rotate-[-20deg] items-center justify-center font-mono text-sm font-bold tracking-[0.2em] text-[#c4b5fd]">DEMO</span>
          </div>
          <div>
            <p className="text-[12px] leading-5 text-white/65">
              {idr.format(amount)} to the {kind === 'retainer' ? 'prevention retainer' : 'CSR protection'} pool. In production this step would be a licensed payment gateway.
            </p>
            <button type="button" className={cn(btnPrimary, 'mt-2')} onClick={confirm}>
              Record simulated pledge
            </button>
          </div>
        </div>
      )}
      {stage === 'done' && <p className="mt-3 text-[12px] text-[#6ee7b7]">Simulated pledge recorded in this browser only.</p>}
    </Panel>
  );
}

export function EscrowTab({ ctx, onViewLocation }: { ctx: HubContext; onViewLocation?: (lat: number, lng: number, zoom: number) => void }) {
  const poolKey = `artemis:pool:${ctx.calendarRegion.id}`;
  const [pool, setPool] = useState<Pledge[]>(() => readLocal<Pledge[]>(poolKey, []));
  useEffect(() => setPool(readLocal<Pledge[]>(poolKey, [])), [poolKey]);
  const total = pool.reduce((s, p) => s + p.amount, 0);
  const live = ctx.target.live;
  const verified = !!live && live.confidence >= 50;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Panel title="Proof-of-extinguish escrow" tag={<SimTag />}>
          <ol>
            <Step state={total > 0 ? 'done' : 'active'} title="1 · Pledge pool">
              {ctx.calendarRegion.name} protection pool holds <span className="font-mono tabular-nums text-white/85">{idr.format(total)}</span> from {pool.length} simulated pledge{pool.length === 1 ? '' : 's'}.
              Retainers pay communities for keeping high-risk weeks fire-free; nothing is paid for a detected fire.
            </Step>
            <Step state={verified ? 'active' : 'pending'} title="2 · 50% operational supply credits">
              {verified
                ? `A live ${live?.satellite ?? live?.source} detection (${live?.confidence}% confidence, ${live?.frp.toFixed(1)} MW) unlocks audited supply credits (fuel, pump parts, N95 masks) for the nearest registered MPA patrol. Credits, not cash.`
                : 'Unlocks only for a live, confident satellite detection. This location has none today, so no credits are released.'}
            </Step>
            <Step state="pending" title="3 · 100% satellite-verified extinguish">
              The remaining credits release when the next VIIRS pass reads 0 MW at this location. Donors then get a before/after thermal receipt. Field confirmation by the MPA patrol is still required.
            </Step>
          </ol>
        </Panel>
        <OverpassPanel lat={ctx.target.lat} lng={ctx.target.lng} />
        <PreIgnitionPanel ctx={ctx} />
      </div>
      <div className="space-y-4">
        <PledgeFlow poolKey={poolKey} onPledged={() => setPool(readLocal<Pledge[]>(poolKey, []))} />
        <div>
          <h3 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/85">Donate now to verified campaigns</h3>
          <DonationWidget
            compact
            currentLocation={ctx.calendarRegion.name}
            onViewLocation={onViewLocation}
          />
          <p className="mt-2 text-[11px] leading-4 text-white/55">
            No campaign for this exact area? The national fund and the pool above always remain, so this location is never a dead end.
          </p>
        </div>
      </div>
    </div>
  );
}
