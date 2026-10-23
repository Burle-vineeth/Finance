import { Component, computed, input, model, signal } from '@angular/core';
import { DatePipe, formatDate } from '@angular/common';
import { IonButton, IonDatetime, IonIcon, IonInput, IonItem, IonModal } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, calendarOutline, close } from 'ionicons/icons';
import {
  PlanRow, MAX_INSTALLMENTS, addPeriods, amountText, checkPlan, fillEvenly, latestPlanDay, rupees, sortPlan, typedAmount,
} from '../../utils/custom-installments';

/**
 * A custom installment plan, one row per installment with its own date and amount. "Fill evenly" lays out
 * N installments from a first date, one every day, week or month; any row can then be changed, added or removed.
 * The plan is checked as it changes, by the same rules as the server.
 */
@Component({
  selector: 'app-installment-plan-editor',
  templateUrl: './installment-plan-editor.component.html',
  styleUrls: ['./installment-plan-editor.component.scss'],
  imports: [DatePipe, IonButton, IonDatetime, IonIcon, IonInput, IonItem, IonModal],
})
export class InstallmentPlanEditorComponent {
  /** The expected return; the installments must add up to it */
  expected = input(0);
  /** The disbursement day, 'YYYY-MM-DD'; no installment can fall before it */
  startDate = input('');
  /** DAILY, WEEKLY or MONTHLY: how far apart "Fill evenly" and "Add installment" put the dates */
  frequency = input('DAILY');
  rows = model<PlanRow[]>([]);

  readonly check = computed(() => checkPlan(this.rows(), this.expected(), this.startDate()));
  readonly period = computed(() => ({ WEEKLY: 'week', MONTHLY: 'month' } as Record<string, string>)[this.frequency()] || 'day');
  readonly latest = computed(() => (this.startDate() ? latestPlanDay(this.startDate()) : undefined));
  readonly rupees = rupees;
  readonly abs = Math.abs;

  // Fill evenly: how many, from which day (blank: one period after disbursement, as a regular loan starts)
  readonly fillCount = signal('');
  readonly fillFirst = signal('');
  readonly showFill = signal(false);
  readonly firstDefault = computed(() => (this.startDate() ? addPeriods(this.frequency(), this.startDate(), 1) : ''));
  readonly firstDay = computed(() => this.fillFirst() || this.firstDefault());
  readonly fillProblem = computed(() => {
    const count = Number(this.fillCount());
    if (!(this.expected() > 0)) return 'Enter the expected return first.';
    if (!this.fillCount()) return '';
    if (!Number.isInteger(count) || count < 1) return 'Enter a whole number of installments.';
    if (count > MAX_INSTALLMENTS) return `At most ${MAX_INSTALLMENTS.toLocaleString('en-IN')} installments.`;
    if (this.firstDay() < this.startDate()) return 'The first installment can\'t be before the disbursement date.';
    return '';
  });
  readonly canFill = computed(() => Boolean(this.fillCount()) && !this.fillProblem());
  readonly fillPreview = computed(() => {
    if (!this.canFill()) return '';
    const plan = fillEvenly(Number(this.fillCount()), this.firstDay(), this.frequency(), this.expected());
    const each = plan[0].amount;
    const last = plan[plan.length - 1];
    return plan.length === 1
      ? `1 installment of ₹${each}`
      : `${plan.length} × ₹${each}${last.amount !== each ? `, the last ₹${last.amount}` : ''}, until ${formatDate(last.date, 'd MMM y', 'en-IN')}`;
  });

  // The row whose date is being picked, or 'first' for Fill evenly's first date
  readonly picking = signal<number | 'first' | null>(null);
  readonly pickerValue = computed(() => {
    const target = this.picking();
    if (target === 'first') return this.firstDay();
    return target === null ? null : this.rows()[target]?.date || this.nextDate();
  });

  constructor() {
    addIcons({ add, close, 'calendar-outline': calendarOutline });
  }

  fill() {
    if (!this.canFill()) return;
    this.rows.set(fillEvenly(Number(this.fillCount()), this.firstDay(), this.frequency(), this.expected()));
    this.showFill.set(false);
  }

  /** The day after the last dated row by one period (or the first default) */
  private nextDate(): string {
    const dated = this.rows().filter((row) => row.date).map((row) => row.date).sort();
    return dated.length ? addPeriods(this.frequency(), dated[dated.length - 1], 1) : this.firstDefault();
  }

  add() {
    // The new installment takes what's still unassigned
    const left = this.check().left;
    this.rows.set([...this.rows(), { date: this.nextDate(), amount: left > 0 ? amountText(left) : '' }]);
  }

  remove(index: number) {
    this.rows.set(this.rows().filter((_, i) => i !== index));
  }

  setAmount(index: number, event: any) {
    const text = typedAmount(event?.detail?.value);
    // Show the cleaned-up text even when it equals what the row already had (a typed letter is dropped)
    if (event?.target) event.target.value = text;
    this.rows.set(this.rows().map((row, i) => (i === index ? { ...row, amount: text } : row)));
  }

  // The picker returns the day, possibly with a time; keep 'YYYY-MM-DD'. Rows stay in date order.
  pickDate(value: any) {
    const target = this.picking();
    const day = typeof value === 'string' ? value.substring(0, 10) : '';
    if (day && target === 'first') this.fillFirst.set(day);
    else if (day && typeof target === 'number') {
      this.rows.set(sortPlan(this.rows().map((row, i) => (i === target ? { ...row, date: day } : row))));
    }
    this.picking.set(null);
  }
}
