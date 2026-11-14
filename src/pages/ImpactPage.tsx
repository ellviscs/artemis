import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { ImpactHub, type HubTab } from '@/components/impact/ImpactHub';
import type { InspectTarget } from '@/components/HotspotInspector';
import { fetchLiveFirmsData } from '@/data/firmsApi';
import { archiveCell, haversineKm } from '@/lib/aoi';
import type { FireHotspot } from '@/types';

const SAME_FIRE_KM = 1.5;
const TABS: HubTab[] = ['escrow', 'ground', 'haze', 'watchdog'];

/** Standalone Impact Hub: /impact?lat=&lng=[&tab=haze][&month=2015-09] */
export function ImpactPage() {
  const [params] = useSearchParams();
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && params.has('lat') && params.has('lng');
  const tabParam = params.get('tab') as HubTab | null;
  const monthParam = params.get('month');
  const [live, setLive] = useState<FireHotspot[]>([]);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    fetchLiveFirmsData()
      .then((d) => !cancelled && setLive(d.viirsHotspots.concat(d.modisHotspots)))
      .catch(() => !cancelled && setLive([]));
    return () => {
      cancelled = true;
    };
  }, [valid]);

  const target = useMemo<InspectTarget | null>(() => {
    if (!valid) return null;
    const nearest = live
      .map((h) => ({ h, d: haversineKm(lat, lng, h.lat, h.lng) }))
      .filter((x) => x.d <= SAME_FIRE_KM)
      .sort((a, b) => a.d - b.d)[0]?.h;
    const m = monthParam?.match(/^(\d{4})-(\d{2})$/);
    return {
      lat,
      lng,
      cell: archiveCell(lat, lng),
      live: nearest,
      archive: m ? { year: Number(m[1]), month: Number(m[2]), value: 0 } : undefined,
    };
  }, [valid, lat, lng, live, monthParam]);

  return (
    <div className="min-h-screen bg-[#07090b] text-white/90">
      <header className="border-b border-white/[0.1] bg-[#080b0e]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white/70 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <span className="font-mono text-sm font-bold tracking-[0.08em] text-white">ARTEMIS</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl border-x border-white/[0.08]">
        {target ? (
          <ImpactHub key={`${target.cell}:${target.live?.id ?? ''}`} variant="page" target={target} liveHotspots={live} initialTab={tabParam && TABS.includes(tabParam) ? tabParam : 'escrow'} />
        ) : (
          <div className="px-4 py-16 text-center">
            <h1 className="font-mono text-sm uppercase tracking-[0.1em] text-white/85">Impact hub</h1>
            <p className="mt-3 text-sm text-white/60">Open a hotspot from the dashboard, or pass coordinates: /impact?lat=-2.2&amp;lng=113.9</p>
            <Link to="/dashboard" className="mt-5 inline-block rounded-[6px] bg-accent-500 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-black hover:bg-accent-400">
              Go to dashboard
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
