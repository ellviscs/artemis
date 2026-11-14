// Year-month helpers for the dashboard date range.

export interface YearMonth {
  year: number;
  month: number; // 1–12
}

/** First month of the MODIS archive and the current month bound the date range. */
export const ARCHIVE_START: YearMonth = { year: 2000, month: 11 };

export function currentYearMonth(): YearMonth {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export const ymKey = (ym: YearMonth) => ym.year * 12 + (ym.month - 1);
export const ymString = (ym: YearMonth) => `${ym.year}-${String(ym.month).padStart(2, '0')}`;

export function parseYm(value: string | null): YearMonth | null {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const ym = { year: Number(match[1]), month: Number(match[2]) };
  return ym.month >= 1 && ym.month <= 12 ? ym : null;
}

export function clampYm(ym: YearMonth): YearMonth {
  const max = currentYearMonth();
  if (ymKey(ym) < ymKey(ARCHIVE_START)) return ARCHIVE_START;
  if (ymKey(ym) > ymKey(max)) return max;
  return ym;
}

