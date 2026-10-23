import { formatDate } from '@angular/common';

// Where a loan stands against its installments, as worked out by the server (services/schedule.js).
// Dates are 'YYYY-MM-DD' India days.
export interface LoanSchedule {
  status: 'UPCOMING' | 'UP_TO_DATE' | 'PAID_AHEAD' | 'DUE_TODAY' | 'PARTLY_PAID' | 'OVERDUE' | 'PAID';
  today: string;
  installment: number;
  installmentsTotal: number;
  installmentsDue: number;
  installmentsPaid: number;
  firstDueDate: string;
  lastDueDate: string;
  termEnded: boolean;
  nextDueDate: string | null;
  overdueSince: string | null;
  paidUntil: string | null;
  dueSoFar: number;
  amountDue: number;
  aheadAmount: number;
  overdueBeforeToday: number;
  unpaidInstallments: number;
  installmentToday: number;
  installmentTodayPaid: number;
  paidToday: number;
}

export interface DueBadge {
  label: string;
  // chip-* class from global.scss ('' for the plain grey chip)
  chip: string;
  icon: string;
  // Money is due now: today's installment or older ones
  toCollect: boolean;
}

// Icons the badges use; pages showing badges register these
export const DUE_BADGE_ICONS = ['alert-circle-outline', 'checkmark-circle-outline', 'checkmark-done-circle-outline', 'calendar-outline'];

const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const shortDate = (day: string) => formatDate(day, 'd MMM', 'en-IN');
const nextDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

export function dueBadge(s: LoanSchedule | null | undefined): DueBadge {
  if (!s) return { label: '', chip: '', icon: 'calendar-outline', toCollect: false };
  // "tomorrow" by the server's India date, the same day the status was worked out for
  const when = (day: string) => (day === nextDay(s.today) ? 'tomorrow' : shortDate(day));

  switch (s.status) {
    case 'OVERDUE':
      return s.termEnded
        ? { label: `Term ended ${shortDate(s.lastDueDate)} · ${rupees(s.amountDue)} due`, chip: 'chip-danger', icon: 'alert-circle-outline', toCollect: true }
        : { label: `Overdue ${rupees(s.amountDue)} · since ${shortDate(s.overdueSince!)}`, chip: 'chip-danger', icon: 'alert-circle-outline', toCollect: true };
    case 'PARTLY_PAID':
      return { label: `${rupees(s.amountDue)} still due today`, chip: 'chip-warning', icon: 'alert-circle-outline', toCollect: true };
    case 'DUE_TODAY':
      return { label: `Due today · ${rupees(s.amountDue)}`, chip: 'chip-warning', icon: 'alert-circle-outline', toCollect: true };
    case 'PAID_AHEAD':
      return { label: `Paid up to ${shortDate(s.paidUntil!)} · ${rupees(s.aheadAmount ?? 0)} extra`, chip: 'chip-success', icon: 'checkmark-done-circle-outline', toCollect: false };
    case 'UP_TO_DATE':
      return s.paidToday > 0
        ? { label: `Collected · next due ${when(s.nextDueDate!)}`, chip: 'chip-success', icon: 'checkmark-circle-outline', toCollect: false }
        : { label: `Next due ${when(s.nextDueDate!)}`, chip: '', icon: 'calendar-outline', toCollect: false };
    case 'UPCOMING':
      return { label: `First due ${when(s.firstDueDate)}`, chip: 'chip-info', icon: 'calendar-outline', toCollect: false };
    case 'PAID':
    default:
      return { label: 'Fully paid', chip: 'chip-success', icon: 'checkmark-done-circle-outline', toCollect: false };
  }
}
