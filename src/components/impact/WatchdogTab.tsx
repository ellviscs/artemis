import { useEffect, useState, type FormEvent } from 'react';
import { FileDown, FileText, Lock, Plus, Trash2 } from 'lucide-react';

import { collectDetections, dossierCsv, dossierHtml, type DossierInput } from '@/lib/dossier';
import { downloadText } from '@/lib/csvExport';
import { readLocal, writeLocal } from '@/lib/localStore';
import { cn } from '@/lib/utils';
import type { FireHotspot } from '@/types';
import { DOSSIER_PERCENTILE, type HubContext } from './hubContext';
import { btnGhost, btnPrimary, Hint, LiveTag, Panel, SimTag } from './shared';

interface Need {
  id: string;
  label: string;
  status: 'needed' | 'pledged' | 'delivered';
}

const DEFAULT_NEEDS: Omit<Need, 'id'>[] = [
  { label: '2× high-pressure water pumps', status: 'needed' },
  { label: '15 boxes of N95 masks', status: 'needed' },
  { label: 'Thermal drone operator (1 day)', status: 'needed' },
  { label: '200 L pump fuel', status: 'needed' },
  { label: 'Field first-aid kits', status: 'needed' },
];
const NEXT: Record<Need['status'], Need['status']> = { needed: 'pledged', pledged: 'delivered', delivered: 'needed' };
const STATUS_STYLE: Record<Need['status'], string> = {
  needed: 'border-[#fdba74]/40 text-[#fdba74]',
  pledged: 'border-[#7dd3fc]/40 text-[#7dd3fc]',
  delivered: 'border-[#6ee7b7]/40 text-[#6ee7b7]',
};

function DossierPanel({ ctx, liveHotspots }: { ctx: HubContext; liveHotspots: FireHotspot[] }) {
  const f = ctx.forensic.data;
  const unlocked = !!f && f.percentile >= DOSSIER_PERCENTILE;
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const input = (): DossierInput | null =>
    f
      ? {
          lat: ctx.target.lat, lng: ctx.target.lng, cell: ctx.target.cell, place: ctx.place,
          regionId: ctx.calendarRegion.id, regionName: ctx.calendarRegion.name, forensic: f, months: ctx.months, liveHotspots,
        }
      : null;

  const makePdf = async () => {
    const data = input();
    if (!data) return;
    // Open the window inside the click so popup blockers allow it, then fill it.
    const win = window.open('', '_blank');
    if (!win) {
      setError('The browser blocked the report window. Allow pop-ups for this site and try again.');
      return;
    }
    win.document.write('<p style="font:14px system-ui;padding:24px">Building dossier…</p>');
    setBusy('pdf');
    setError(null);
    try {
      const { rows, archiveYear } = await collectDetections(data);
      win.document.open();
      win.document.write(dossierHtml(data, rows, archiveYear));
      win.document.close();
    } catch (e: unknown) {
      win.close();
      setError(e instanceof Error ? e.message : 'Could not build the dossier.');
    } finally {
      setBusy(null);
    }
  };

  const makeCsv = async () => {
    const data = input();
    if (!data) return;
    setBusy('csv');
    setError(null);
    try {
      const { rows } = await collectDetections(data);
      downloadText(`artemis_dossier_${data.cell}.csv`, dossierCsv(data, rows));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not build the CSV.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title="Civic watchdog dossier" tag={<LiveTag>Archive + NRT</LiveTag>}>
      <Hint>
        A neutral evidence file for Gakkum KLHK or SP4N-LAPOR!: coordinates, the 20-year anomaly record, detections and the four signature features. It reports observations, not who started a fire.
      </Hint>
      <div className={cn('mt-3 rounded-[4px] border px-3 py-2.5 text-[12px] leading-5', unlocked ? 'border-[#fca5a5]/30 bg-[#fca5a5]/[0.05] text-white/80' : 'border-white/[0.12] text-white/65')}>
        {ctx.forensic.status === 'loading' && 'Reading the signature…'}
        {(ctx.forensic.status === 'none' || ctx.forensic.status === 'error') && 'This cell has too little fire history to score, so no dossier can be generated.'}
        {f && (
          <>
            Unlocks for the top {100 - DOSSIER_PERCENTILE}% of Indonesian fire cells (percentile ≥ {DOSSIER_PERCENTILE}). This cell is at{' '}
            <strong className={unlocked ? 'text-[#fca5a5]' : 'text-white/85'}>p{Math.round(f.percentile)}</strong> with a score of {Math.round(f.score)}.{' '}
            {!unlocked && 'Use the citizen ground-truth tab to add field labels instead.'}
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={!unlocked || busy !== null} onClick={makePdf}>
          {unlocked ? <FileText className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />} {busy === 'pdf' ? 'Building…' : 'Generate evidence dossier (PDF)'}
        </button>
        <button type="button" className={btnGhost} disabled={!unlocked || busy !== null} onClick={makeCsv}>
          <FileDown className="h-3.5 w-3.5" /> {busy === 'csv' ? 'Building…' : 'Detections CSV'}
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-[#fca5a5]">{error}</p>}
      <p className="mt-2 text-[11px] leading-4 text-white/55">The PDF opens as a printable page: use “Print / save as PDF”.</p>
    </Panel>
  );
}

function P2PBoard({ cell }: { cell: string }) {
  const key = `artemis:p2p:${cell}`;
  const seed = () => DEFAULT_NEEDS.map((n, i) => ({ ...n, id: `seed-${i}` }));
  const [needs, setNeeds] = useState<Need[]>(() => readLocal<Need[] | null>(key, null) ?? seed());
  const [draft, setDraft] = useState('');
  useEffect(() => setNeeds(readLocal<Need[] | null>(key, null) ?? seed()), [key]);

  const update = (next: Need[]) => {
    setNeeds(next);
    writeLocal(key, next);
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    const label = draft.trim();
    if (!label) return;
    update([...needs, { id: crypto.randomUUID(), label, status: 'needed' }]);
    setDraft('');
  };

  return (
    <Panel title="P2P logistics board" tag={<SimTag kind="Demo" />}>
      <Hint>Field teams list physical needs; nearby universities, Mapala groups and pharmacies pledge and deliver directly. Stored in this browser only.</Hint>
      <ul className="mt-3 divide-y divide-white/[0.06]">
        {needs.map((n) => (
          <li key={n.id} className="flex items-center justify-between gap-3 py-2">
            <span className={cn('text-[13px]', n.status === 'delivered' ? 'text-white/55 line-through' : 'text-white/85')}>{n.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => update(needs.map((x) => (x.id === n.id ? { ...x, status: NEXT[x.status] } : x)))}
                className={cn('rounded-[2px] border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]', STATUS_STYLE[n.status])}
                aria-label={`${n.label}: ${n.status}. Change status`}
              >
                {n.status}
              </button>
              <button type="button" onClick={() => update(needs.filter((x) => x.id !== n.id))} aria-label={`Remove ${n.label}`} className="rounded-[4px] p-1.5 text-white/55 hover:bg-white/[0.06] hover:text-white">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <label htmlFor="need-input" className="sr-only">New need</label>
        <input
          id="need-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. 4 fire beaters"
          className="min-w-0 flex-1 rounded-[4px] border border-white/[0.14] bg-[#0d0d0d] px-2.5 py-1.5 text-[13px] text-white/85 placeholder:text-white/45"
        />
        <button type="submit" className={btnGhost}>
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </form>
    </Panel>
  );
}

export function WatchdogTab({ ctx, liveHotspots }: { ctx: HubContext; liveHotspots: FireHotspot[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DossierPanel ctx={ctx} liveHotspots={liveHotspots} />
      <P2PBoard cell={ctx.target.cell} />
    </div>
  );
}
