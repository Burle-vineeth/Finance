import { formatDate } from '@angular/common';

// A custom installment plan as the forms hold it: one row per installment, its date as 'YYYY-MM-DD' and its
// amount as typed. The server checks plans by the same rules, in the same words (services/customInstallments.js):
//   1 to 1,000 installments; each on a real date, no earlier than the disbursement date and at most 10 years
//   after it; no two on the same day; each amount more than zero, to the paisa; all adding up to the expected return.
export interface PlanRow {
  date: string;
  amount: string;
}

export interface PlanCheck {
  /** What is wrong, as the server would say it; empty when the plan is good */
  problems: string[];
  /** Rows with a bad date or amount, by position */
  badDates: Set<number>;
  badAmounts: Set<number>;
  /** The good amounts added up, and what is left to reach the expected return (below zero: over) */
  total: number;
  left: number;
  ok: boolean;
}

export const MAX_INSTALLMENTS = 1000;
const MAX_YEARS = 10;

const paise = (amount: number) => Math.round(amount * 100);
export const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
// '2026-09-14' → '14 Sept 2026', as the server and the rest of the app write it
const longDate = (key: string) => formatDate(key, 'd MMM y', 'en-IN');

/** An amount as the fields show it: 1200.5 → '1,200.5' */
export const amountText = (amount: number) => amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** What was typed in an amount field, cleaned up as it is typed: digits with Indian grouping, up to 2 decimals */
export const typedAmount = (text: string | null | undefined): string => {
  const [whole, ...rest] = String(text ?? '').replace(/[^0-9.]/g, '').split('.');
  const digits = whole.replace(/^0+(?=\d)/, '');
  const grouped = digits ? Number(digits).toLocaleString('en-IN') : rest.length ? '0' : '';
  return rest.length ? `${grouped}.${rest.join('').slice(0, 2)}` : grouped;
};

/** An amount as typed ('1,200.50'), or NaN when blank or not a number */
export const parseAmount = (text: string | number | null | undefined): number => {
  const value = String(text ?? '').replace(/,/g, '').trim();
  return value === '' ? NaN : Number(value);
};

// Day arithmetic on 'YYYY-MM-DD' keys in UTC, as the server does it
const keyOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const isRealDay = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(key) && keyOf(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) === key;

/** n days, weeks or months after a day; a day the month doesn't have becomes its last day (31 Jan → 28 Feb → 31 Mar) */
export function addPeriods(frequency: string, key: string, periods: number): string {
  const [y, m, d] = key.split('-').map(Number);
  if (frequency === 'MONTHLY') {
    const lastDay = new Date(Date.UTC(y, m - 1 + periods + 1, 0)).getUTCDate();
    return keyOf(y, m - 1 + periods, Math.min(d, lastDay));
  }
  return keyOf(y, m - 1, d + (frequency === 'WEEKLY' ? 7 : 1) * periods);
}

/** The latest day an installment can fall on, 10 years after disbursement */
export const latestPlanDay = (startDate: string) => {
  const [y, m, d] = startDate.split('-').map(Number);
  return keyOf(y + MAX_YEARS, m - 1, d);
};

export function checkPlan(rows: PlanRow[], expected: number, startDate: string): PlanCheck {
  const check: PlanCheck = { problems: [], badDates: new Set(), badAmounts: new Set(), total: 0, left: expected, ok: false };
  if (!rows.length) {
    check.problems.push('Add at least one installment');
    return check;
  }
  if (rows.length > MAX_INSTALLMENTS) {
    check.problems.push(`A plan can have at most ${MAX_INSTALLMENTS.toLocaleString('en-IN')} installments`);
    return check;
  }

  const latest = startDate ? latestPlanDay(startDate) : '';
  const firstOnDay = new Map<string, number>();
  let amountsGood = true;
  let total = 0;
  rows.forEach((row, index) => {
    const label = `Installment ${index + 1}`;
    const key = row.date;
    let dateProblem = '';
    if (!key) dateProblem = `${label} needs a date`;
    else if (!isRealDay(key)) dateProblem = `${label}: pick a valid date`;
    else if (startDate && key < startDate) dateProblem = `${label} (${longDate(key)}) is before the disbursement date, ${longDate(startDate)}`;
    else if (latest && key > latest) dateProblem = `${label} (${longDate(key)}) is more than ${MAX_YEARS} years after the disbursement`;
    else if (firstOnDay.has(key)) dateProblem = `Installments ${firstOnDay.get(key)! + 1} and ${index + 1} are both on ${longDate(key)}`;
    else firstOnDay.set(key, index);
    if (dateProblem) {
      check.problems.push(dateProblem);
      check.badDates.add(index);
    }

    const amount = parseAmount(row.amount);
    let amountProblem = '';
    if (!Number.isFinite(amount)) amountProblem = `${label} needs an amount`;
    else if (amount <= 0) amountProblem = `${label}: the amount must be more than zero`;
    else if (Math.abs(amount * 100 - paise(amount)) > 1e-6) amountProblem = `${label}: the amount can't go below a paisa (2 decimal places)`;
    if (amountProblem) {
      check.problems.push(amountProblem);
      check.badAmounts.add(index);
    }
    if (Number.isFinite(amount) && amount > 0) total += paise(amount); else amountsGood = false;
  });

  check.total = total / 100;
  check.left = (paise(expected) - total) / 100;
  if (amountsGood && expected > 0 && total !== paise(expected)) {
    check.problems.push(`The installments add up to ${rupees(total / 100)}, but the expected return is ${rupees(expected)} `
      + `(${rupees(Math.abs(check.left))} ${check.left > 0 ? 'short' : 'over'})`);
  }
  check.ok = !check.problems.length && expected > 0;
  return check;
}

/** `count` installments from `firstDate`, one every day, week or month, splitting `expected` evenly; the last takes the rounding */
export function fillEvenly(count: number, firstDate: string, frequency: string, expected: number): PlanRow[] {
  const each = Math.floor((expected / count) * 100) / 100;
  const last = (paise(expected) - paise(each) * (count - 1)) / 100;
  return Array.from({ length: count }, (_, i) => ({
    date: addPeriods(frequency, firstDate, i),
    amount: amountText(i === count - 1 ? last : each),
  }));
}

/** Dated rows first, in date order (rows still without a date stay at the end, as they were) */
export const sortPlan = (rows: PlanRow[]): PlanRow[] =>
  rows.map((row, i) => ({ row, i })).sort((a, b) => {
    if (a.row.date && b.row.date) return a.row.date < b.row.date ? -1 : a.row.date > b.row.date ? 1 : a.i - b.i;
    return a.row.date ? -1 : b.row.date ? 1 : a.i - b.i;
  }).map(({ row }) => row);

/** The same installments on the same days? */
export const samePlan = (a: PlanRow[], b: PlanRow[]): boolean => {
  const text = (rows: PlanRow[]) => rows.map((r) => `${r.date}=${paise(parseAmount(r.amount))}`).sort().join(',');
  return text(a) === text(b);
};

/** A stored plan ([{ date, amount }], dates as UTC midnight) as form rows */
export const planRows = (plan: { date: string; amount: number }[] | null | undefined): PlanRow[] =>
  (plan || []).map((row) => ({ date: String(row.date).substring(0, 10), amount: amountText(row.amount) }));

/** Form rows as the server takes them */
export const planPayload = (rows: PlanRow[]) => rows.map((row) => ({ date: row.date, amount: parseAmount(row.amount) }));

export type PlanRowState = 'paid' | 'part' | 'due' | 'overdue' | 'upcoming';

/** Each installment of a stored plan against what has been repaid, oldest first */
export function planProgress(plan: { date: string; amount: number }[], repaid: number, today: string) {
  let left = repaid;
  return planRows(plan).map((row, index) => {
    const amount = parseAmount(row.amount);
    const paid = Math.round(Math.max(0, Math.min(amount, left)) * 100) / 100;
    left -= paid;
    let state: PlanRowState;
    // Within half a paisa counts as paid, as on the server
    if (paid + 0.005 >= amount) state = 'paid';
    else if (row.date < today) state = 'overdue';
    else if (row.date === today) state = 'due';
    else state = paid > 0 ? 'part' : 'upcoming';
    return { number: index + 1, date: row.date, amount, paid, state };
  });
}
