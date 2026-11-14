// Everything the Impact Hub tabs share about the selected location, loaded once.
import { useEffect, useState } from 'react';

import { fetchForensicCell, fetchRegionCalendar, type ForensicCell, type MonthRecord, type MonthBaseline } from '@/data/historyApi';
import { reverseGeocode } from '@/data/locationApi';
import { INDONESIA_PROVINCES } from '@/data/regions';
import { currentYearMonth, type YearMonth } from '@/state/yearMonth';
import type { InspectTarget } from '@/components/HotspotInspector';

/** Dossier unlocks for the top 10% of Indonesian fire cells by signature score. */
export const DOSSIER_PERCENTILE = 90;

export interface HubContext {
  target: InspectTarget;
  place: string | null;
  forensic: { status: 'loading' | 'ready' | 'none' | 'error'; data?: ForensicCell };
  /** Calendar region used for anomaly and seasonality (one of the five provinces, else Indonesia). */
  calendarRegion: { id: string; name: string };
  /** Month the anomaly refers to: the archive month opened, else the current month. */
  month: YearMonth;
  monthRecord: MonthRecord | null;
  months: MonthRecord[];
  baseline: Record<string, MonthBaseline> | null;
}

function regionFor(lat: number, lng: number, provinceName?: string): { id: string; name: string } {
  const byName = provinceName && INDONESIA_PROVINCES.find((p) => p.name.toLowerCase() === provinceName.toLowerCase());
  if (byName) return { id: byName.id, name: byName.name };
  if (!provinceName) {
    const byBox = INDONESIA_PROVINCES.find(
      (p) => lat >= p.bbox.minLat && lat <= p.bbox.maxLat && lng >= p.bbox.minLng && lng <= p.bbox.maxLng,
    );
    if (byBox) return { id: byBox.id, name: byBox.name };
  }
  return { id: 'indonesia', name: 'Indonesia' };
}

export function useHubContext(target: InspectTarget): HubContext {
  const [place, setPlace] = useState<string | null>(null);
  const [forensic, setForensic] = useState<HubContext['forensic']>({ status: 'loading' });
  const [calendar, setCalendar] = useState<{ months: MonthRecord[]; baseline: Record<string, MonthBaseline> } | null>(null);

  const month: YearMonth = target.archive ? { year: target.archive.year, month: target.archive.month } : currentYearMonth();
  const calendarRegion = regionFor(target.lat, target.lng, forensic.data?.province);

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

  useEffect(() => {
    if (forensic.status === 'loading') return;
    let cancelled = false;
    fetchRegionCalendar(calendarRegion.id)
      .then((c) => !cancelled && setCalendar({ months: c.variants.masked.months, baseline: c.variants.masked.baseline }))
      .catch(() => !cancelled && setCalendar(null));
    return () => {
      cancelled = true;
    };
  }, [calendarRegion.id, forensic.status]);

  const months = calendar?.months ?? [];
  const monthRecord = months.find((m) => m.year === month.year && m.month === month.month) ?? null;
  return { target, place, forensic, calendarRegion, month, monthRecord, months, baseline: calendar?.baseline ?? null };
}
