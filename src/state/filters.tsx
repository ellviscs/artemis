// Dashboard filter state shared by the control bar, map, calendar and exports.
// Everything except the transient draw mode is mirrored in the URL so a view can be shared.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DEFAULT_AOI, decodeAoi, encodeAoi, type Aoi } from '@/lib/aoi';
import { RAMP_IDS, type RampId } from '@/lib/colorRamps';
import { ARCHIVE_START, clampYm, currentYearMonth, parseYm, ymKey, ymString, type YearMonth } from '@/state/yearMonth';

export type DrawMode = 'none' | 'point' | 'polygon';

export interface Filters {
  aoi: Aoi;
  start: YearMonth;
  end: YearMonth;
  ramp: RampId;
  maskStatic: boolean;
  /** Month selected on the calendar; drives the map. Null = live view. */
  focus: YearMonth | null;
  /** Calendar value mode. */
  mode: 'harmonized' | 'raw';
}

function readFilters(params: URLSearchParams): Filters {
  const now = currentYearMonth();
  let start = clampYm(parseYm(params.get('from')) ?? ARCHIVE_START);
  let end = clampYm(parseYm(params.get('to')) ?? now);
  if (ymKey(start) > ymKey(end)) [start, end] = [end, start];
  const ramp = params.get('ramp') as RampId | null;
  return {
    aoi: decodeAoi(params) ?? DEFAULT_AOI,
    start,
    end,
    ramp: ramp && RAMP_IDS.includes(ramp) ? ramp : 'viridis',
    maskStatic: params.get('mask') !== '0',
    focus: (() => {
      const f = parseYm(params.get('month'));
      return f ? clampYm(f) : null;
    })(),
    mode: params.get('mode') === 'raw' ? 'raw' : 'harmonized',
  };
}

function writeFilters(f: Filters): URLSearchParams {
  const params = new URLSearchParams(encodeAoi(f.aoi));
  params.set('from', ymString(f.start));
  params.set('to', ymString(f.end));
  params.set('ramp', f.ramp);
  if (!f.maskStatic) params.set('mask', '0');
  if (f.focus) params.set('month', ymString(f.focus));
  if (f.mode === 'raw') params.set('mode', 'raw');
  return params;
}

interface FiltersContextValue extends Filters {
  setFilters: (patch: Partial<Filters>) => void;
  drawMode: DrawMode;
  setDrawMode: (mode: DrawMode) => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const filters = useMemo(() => readFilters(params), [params]);

  const setFilters = useCallback((patch: Partial<Filters>) => {
    setParams((current) => writeFilters({ ...readFilters(current), ...patch }), { replace: true });
  }, [setParams]);

  const value = useMemo(
    () => ({ ...filters, setFilters, drawMode, setDrawMode }),
    [filters, setFilters, drawMode],
  );
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used inside <FiltersProvider>.');
  return ctx;
}
