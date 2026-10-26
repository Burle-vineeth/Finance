import { Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForward, arrowDown, arrowUp } from 'ionicons/icons';

export interface CalendarMarker {
  date?: string | Date | null;
  label: string;
}

/** Ledger transaction types the calendar can draw */
export type CalendarType = 'REPAYMENT' | 'CAPITAL_INJECTION' | 'CAPITAL_WITHDRAWAL';

// How each type reads on the calendar
const KINDS: Record<CalendarType, { one: string; many: string; verb: string; title: string; moneyIn: boolean }> = {
  REPAYMENT: { one: 'payment', many: 'payments', verb: 'collected', title: 'Repayment', moneyIn: true },
  CAPITAL_INJECTION: { one: 'injection', many: 'injections', verb: 'injected', title: 'Capital injected', moneyIn: true },
  CAPITAL_WITHDRAWAL: { one: 'withdrawal', many: 'withdrawals', verb: 'withdrawn', title: 'Capital withdrawn', moneyIn: false },
};

interface DayCell {
  key: string;
  day: number;
  entries: any[];
  total: number;
  markers: string[];
  level: number;
  isToday: boolean;
}

// Local calendar day, e.g. 2026-10-22, so a payment lands on the day the ledger shows it
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

// Up to 2 decimals without trailing zeros: 1.05, 2.4, 12
const twoDecimals = (value: number) => String(Number(value.toFixed(2)));

@Component({
  selector: 'app-payment-calendar',
  templateUrl: './payment-calendar.component.html',
  styleUrls: ['./payment-calendar.component.scss'],
  imports: [CurrencyPipe, DatePipe, IonButton, IonIcon],
  // Picks the shade for the type drawn (see the scss)
  host: { '[attr.data-type]': 'type()' },
})
export class PaymentCalendarComponent {
  /** Ledger transactions; only those of `type` are drawn on the calendar */
  transactions = input<any[]>([]);
  /** Which money to draw: repayments collected, or capital injected or withdrawn */
  type = input<CalendarType>('REPAYMENT');
  /** Loan id -> client name. Repayments don't carry the client, so this names who paid. */
  loanNames = input<Record<string, string>>({});
  /** Other dates to flag on the calendar, e.g. when the loan was disbursed */
  markers = input<CalendarMarker[]>([]);
  /** Shade days by how much was collected (overall view) instead of one "paid" colour (single loan) */
  heatmap = input(false);

  readonly weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  private pickedMonth = signal<Date | null>(null);
  selectedKey = signal<string | null>(null);

  kind = computed(() => KINDS[this.type()]);

  private entries = computed(() => (this.transactions() || []).filter((t) => t.type === this.type()));

  private entriesByDay = computed(() => {
    const byDay = new Map<string, any[]>();
    for (const t of this.entries()) {
      const key = dayKey(new Date(t.date));
      const list = byDay.get(key);
      if (list) list.push(t); else byDay.set(key, [t]);
    }
    return byDay;
  });

  private markersByDay = computed(() => {
    const byDay = new Map<string, string[]>();
    for (const m of this.markers() || []) {
      if (!m.date) continue;
      const key = dayKey(new Date(m.date));
      byDay.set(key, [...(byDay.get(key) || []), m.label]);
    }
    return byDay;
  });

  /** Opens on this month, or on the month of the last entry when there has been none since */
  month = computed(() => {
    const picked = this.pickedMonth();
    if (picked) return picked;
    const thisMonth = startOfMonth(new Date());
    let latest: Date | null = null;
    for (const t of this.entries()) {
      const d = new Date(t.date);
      if (!latest || d > latest) latest = d;
    }
    return latest && latest < thisMonth ? startOfMonth(latest) : thisMonth;
  });

  isCurrentMonth = computed(() => this.month().getTime() === startOfMonth(new Date()).getTime());

  grid = computed(() => {
    const first = this.month();
    const year = first.getFullYear();
    const month = first.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = dayKey(new Date());
    const byDay = this.entriesByDay();
    const marks = this.markersByDay();

    const days: DayCell[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dayKey(new Date(year, month, day));
      const entries = byDay.get(key) || [];
      const total = entries.reduce((sum, t) => sum + (t.amount || 0), 0);
      days.push({ key, day, entries, total, markers: marks.get(key) || [], level: 0, isToday: key === todayKey });
    }

    // Heat levels 1-4 relative to the biggest day of the month (square root, so one large amount
    // doesn't wash out every other day); a single loan just marks paid days
    const max = Math.max(0, ...days.map((c) => c.total));
    for (const c of days) {
      if (c.total <= 0) continue;
      c.level = this.heatmap() ? Math.max(1, Math.ceil(Math.sqrt(c.total / max) * 4)) : 4;
    }

    const total = days.reduce((sum, c) => sum + c.total, 0);
    const count = days.reduce((sum, c) => sum + c.entries.length, 0);
    // Legend only for the markers that fall in this month
    const labels = new Set<string>();
    days.forEach((c) => c.markers.forEach((label) => labels.add(label)));
    const markerLegend = [...labels].join(' / ');
    return { offset: first.getDay(), days, total, count, markerLegend };
  });

  selectedDay = computed(() => this.grid().days.find((c) => c.key === this.selectedKey()) ?? null);

  constructor() {
    addIcons({ 'chevron-back': chevronBack, 'chevron-forward': chevronForward, 'arrow-down': arrowDown, 'arrow-up': arrowUp });
  }

  shiftMonth(delta: number) {
    const current = this.month();
    this.pickedMonth.set(new Date(current.getFullYear(), current.getMonth() + delta, 1));
    this.selectedKey.set(null);
  }

  goToToday() {
    this.pickedMonth.set(startOfMonth(new Date()));
    this.selectedKey.set(dayKey(new Date()));
  }

  select(key: string) {
    this.selectedKey.set(this.selectedKey() === key ? null : key);
  }

  entryTitle(t: any): string {
    if (this.type() !== 'REPAYMENT') return t.notes || this.kind().title;
    const loanId = t.loan?._id || t.loan;
    return this.loanNames()[loanId] || t.client?.name || 'Repayment';
  }

  /** Short amount that fits in a day cell: ₹600, ₹1.05k, ₹12.35k, ₹1.25L */
  compact(amount: number): string {
    // The unit is picked after rounding, so 99,999 reads ₹1L rather than ₹100k
    if (Number(twoDecimals(amount)) < 1000) return `₹${twoDecimals(amount)}`;
    if (Number(twoDecimals(amount / 1000)) < 100) return `₹${twoDecimals(amount / 1000)}k`;
    return `₹${twoDecimals(amount / 100000)}L`;
  }
}
