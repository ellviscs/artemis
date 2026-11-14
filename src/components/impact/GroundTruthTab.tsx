import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, MessageSquareText, Trash2 } from 'lucide-react';

import { readLocal, writeLocal } from '@/lib/localStore';
import { cn } from '@/lib/utils';
import type { HubContext } from './hubContext';
import { btnGhost, btnPrimary, Hint, Panel, SimTag } from './shared';

const LABELS_KEY = 'artemis:labels';

const REPLIES = {
  '1': 'Confirmed fire',
  '2': 'Controlled agri burn',
  '3': 'False alarm',
} as const;
type Reply = keyof typeof REPLIES;

const PHOTO_KINDS = ['Smoke column', 'Open flame', 'Fresh burn scar', 'No fire visible'] as const;

interface GroundLabel {
  id: string;
  cell: string;
  lat: number;
  lng: number;
  at: string;
  channel: 'sms' | 'photo';
  label: string;
  note?: string;
}

interface ChatLine {
  from: 'bot' | 'patrol';
  text: string;
}

function alertText(ctx: HubContext): string {
  const h = ctx.target.live;
  const when = h ? `${h.date} ${h.acqTime} UTC` : new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  return [
    'ARTEMIS HOTSPOT ALERT',
    `${ctx.target.lat.toFixed(4)}, ${ctx.target.lng.toFixed(4)}`,
    ctx.place ? ctx.place.split(',').slice(0, 2).join(',') : ctx.calendarRegion.name,
    `${when}${h ? ` · ${h.satellite ?? h.source} · FRP ${h.frp.toFixed(1)} MW` : ''}`,
    'Reply 1 = Confirmed fire, 2 = Controlled agri burn, 3 = False alarm',
  ].join('\n');
}

export function GroundTruthTab({ ctx }: { ctx: HubContext }) {
  const { cell, lat, lng } = ctx.target;
  const [labels, setLabels] = useState<GroundLabel[]>(() => readLocal<GroundLabel[]>(LABELS_KEY, []));
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [photoKind, setPhotoKind] = useState<string>(PHOTO_KINDS[0]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setChat([{ from: 'bot', text: alertText(ctx) }]), [ctx.place, cell]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const mine = useMemo(() => labels.filter((l) => l.cell === cell).slice().reverse(), [labels, cell]);

  const save = (entry: Omit<GroundLabel, 'id' | 'cell' | 'lat' | 'lng' | 'at'>) => {
    const next = [...readLocal<GroundLabel[]>(LABELS_KEY, []), { ...entry, id: crypto.randomUUID(), cell, lat, lng, at: new Date().toISOString() }];
    writeLocal(LABELS_KEY, next);
    setLabels(next);
  };

  const reply = (r: Reply) => {
    setChat((c) => [
      ...c,
      { from: 'patrol', text: r },
      { from: 'bot', text: `Received: ${REPLIES[r]}. Logged as a pending validation label for cell ${cell.slice(0, 9)}. Terima kasih.` },
    ]);
    save({ channel: 'sms', label: REPLIES[r] });
  };

  const submitPhoto = () => {
    if (!photo) return;
    save({ channel: 'photo', label: photoKind, note: photo.name });
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const remove = (id: string) => {
    const next = readLocal<GroundLabel[]>(LABELS_KEY, []).filter((l) => l.id !== id);
    writeLocal(LABELS_KEY, next);
    setLabels(next);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Panel title="SMS / WhatsApp bot preview" tag={<SimTag />}>
        <Hint>How an MPA patrol with no data signal gets the alert and answers with one digit.</Hint>
        <div className="mt-3 rounded-[6px] border border-white/[0.14] bg-[#0a0d0f] p-3">
          <div className="mb-2 flex items-center gap-2 border-b border-white/[0.08] pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-white/55">
            <MessageSquareText className="h-3.5 w-3.5" /> ARTEMIS · +62 SMS gateway
          </div>
          <ol className="max-h-64 space-y-2 overflow-y-auto" aria-live="polite">
            {chat.map((m, i) => (
              <li key={i} className={cn('max-w-[90%] whitespace-pre-line rounded-[4px] px-2.5 py-2 font-mono text-[11px] leading-4', m.from === 'bot' ? 'bg-white/[0.07] text-white/85' : 'ml-auto bg-accent-500/20 text-accent-100')}>
                {m.text}
              </li>
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Reply as patrol">
            {(Object.keys(REPLIES) as Reply[]).map((r) => (
              <button key={r} type="button" onClick={() => reply(r)} className={btnGhost} title={REPLIES[r]}>
                Reply {r}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="Geotagged photo upload" tag={<SimTag />}>
          <Hint>
            Citizens or rangers attach a smoke photo. The file stays in this browser: it is previewed, not uploaded, and only its name and your label are kept.
          </Hint>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
            <label className={cn(btnGhost, 'cursor-pointer')}>
              <Camera className="h-3.5 w-3.5" /> Choose photo
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPhoto({ url: URL.createObjectURL(file), name: file.name });
                }}
              />
            </label>
            {photo && (
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <img src={photo.url} alt="Selected field photo preview" className="h-24 w-32 rounded-[4px] border border-white/[0.12] object-cover" />
                <div className="flex-1">
                  <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-white/55" htmlFor="photo-kind">What does it show?</label>
                  <select id="photo-kind" value={photoKind} onChange={(e) => setPhotoKind(e.target.value)} className="mt-1 w-full rounded-[4px] border border-white/[0.14] bg-[#0d0d0d] px-2 py-1.5 text-[13px] text-white/85">
                    {PHOTO_KINDS.map((k) => <option key={k}>{k}</option>)}
                  </select>
                  <button type="button" onClick={submitPhoto} className={cn(btnPrimary, 'mt-2')}>Submit label</button>
                </div>
              </div>
            )}
          </div>
        </Panel>

        <Panel title={`Pending validation labels · ${mine.length}`} tag={<SimTag kind="Demo" />}>
          <Hint>
            In production these replies become active-learning labels that check the signature score. Here they are stored only in this browser.
          </Hint>
          {mine.length === 0 ? (
            <p className="mt-3 text-[13px] text-white/55">No labels for this cell yet. Reply in the bot or submit a photo.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {mine.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[13px] text-white/85">{l.label}</p>
                    <p className="truncate font-mono text-[10px] text-white/55">
                      {l.channel === 'sms' ? 'SMS reply' : `Photo · ${l.note}`} · {l.at.slice(0, 16).replace('T', ' ')} · pending
                    </p>
                  </div>
                  <button type="button" onClick={() => remove(l.id)} aria-label={`Delete label ${l.label}`} className="rounded-[4px] p-1.5 text-white/55 hover:bg-white/[0.06] hover:text-white">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
