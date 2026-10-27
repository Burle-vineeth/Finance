import { formatDate } from '@angular/common';

// The date ranges the collections chart and the business score offer (see components/range-picker), and day
// arithmetic on 'YYYY-MM-DD' keys

export type RangeKind = 'all' | 'week' | 'month' | 'quarter' | 'half' | 'year' | 'custom';
export type PeriodKind = 'week' | 'month' | 'quarter' | 'half' | 'year';

const MONTHS_IN: Record<Exclude<PeriodKind, 'week'>, number> = { month: 1, quarter: 3, half: 6, year: 12 };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// In UTC so no time zone or daylight saving shifts a day
export const keyOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
export const partsOf = (key: string) => key.split('-').map(Number) as [number, number, number];
export const addDays = (key: string, days: number) => { const [y, m, d] = partsOf(key); return keyOf(y, m - 1, d + days); };
export const addMonths = (key: string, months: number) => { const [y, m, d] = partsOf(key); return keyOf(y, m - 1 + months, d); };
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
// For formatDate: the key's day at local midnight, so it prints as that day in any time zone
const localDate = (key: string) => { const [y, m, d] = partsOf(key); return new Date(y, m - 1, d); };
export const showDay = (key: string, format: string) => formatDate(localDate(key), format, 'en-IN');

/** The Monday of the week holding `key` (weeks run Monday to Sunday) */
export const weekStart = (key: string) => addDays(key, -((new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7));

// The day a period of this kind starts, for the period holding `key` (weeks from Monday; calendar quarters,
// halves and years)
export const periodStart = (kind: PeriodKind, key: string) => {
  if (kind === 'week') return weekStart(key);
  const [y, m] = partsOf(key);
  const size = MONTHS_IN[kind];
  return keyOf(y, Math.floor((m - 1) / size) * size, 1);
};

// The last day of the period starting on `start`
export const periodEnd = (kind: PeriodKind, start: string) =>
  (kind === 'week' ? addDays(start, 6) : addDays(addMonths(start, MONTHS_IN[kind]), -1));

// The start of the period `delta` periods before or after the one starting on `start`
export const shiftPeriod = (kind: PeriodKind, start: string, delta: number) =>
  (kind === 'week' ? addDays(start, 7 * delta) : addMonths(start, delta * MONTHS_IN[kind]));

/** How a period reads: 26 Oct – 1 Nov 2026, October 2026, Q4 2026 · Oct–Dec, H2 2026 · Jul–Dec, 2026 */
export const describePeriod = (kind: PeriodKind, start: string) => {
  const end = periodEnd(kind, start);
  const [y, m] = partsOf(start);
  const months = `${MONTH_NAMES[m - 1]}–${MONTH_NAMES[partsOf(end)[1] - 1]}`;
  // A week across New Year shows both years
  if (kind === 'week') return `${showDay(start, y === partsOf(end)[0] ? 'd MMM' : 'd MMM y')} – ${showDay(end, 'd MMM y')}`;
  if (kind === 'month') return showDay(start, 'MMMM y');
  if (kind === 'quarter') return `Q${Math.floor((m - 1) / 3) + 1} ${y} · ${months}`;
  if (kind === 'half') return `H${m <= 6 ? 1 : 2} ${y} · ${months}`;
  return String(y);
};
