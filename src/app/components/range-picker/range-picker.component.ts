import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { IonButton, IonIcon, IonItem, IonModal, IonDatetime } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, checkmark, chevronBack, chevronDown, chevronForward } from 'ionicons/icons';
import { localToday } from '../../utils/dates';
import {
  PeriodKind, RangeKind, addDays, daysBetween, describePeriod, partsOf, periodEnd, periodStart, shiftPeriod, showDay
} from '../../utils/periods';

/** What the picker shows, and what to compare it with */
export interface PickedRange {
  kind: RangeKind;
  /** Left out for all time: from the first loan to today */
  from?: string;
  to?: string;
  /** How it reads: October 2026, Q4 2026 · Oct–Dec, Since 15 Jul 2026 */
  label: string;
  /** The period just before (September for October), or for a custom range the same number of days before it */
  compare: { from: string; to: string; label: string } | null;
}

const NAMES: Record<RangeKind, string> = {
  week: 'Week', month: 'Month', quarter: 'Quarter', half: 'Half year', year: 'Year', all: 'All time', custom: 'Custom range',
};
const PRESETS: PeriodKind[] = ['week', 'month', 'quarter', 'half', 'year'];

// Two days as a range: 27 Sept – 26 Oct 2026 (the first one's year only when it differs)
const spanLabel = (from: string, to: string) =>
  `${showDay(from, partsOf(from)[0] === partsOf(to)[0] ? 'd MMM' : 'd MMM y')} – ${showDay(to, 'd MMM y')}`;

// Each picker's date fields need ids of their own: the chart's and the business score's can be in the page at once
let nextId = 0;

// The date range for the collections chart and the business score: one compact control (‹ Month · October 2026 ›)
// that steps between periods, and a sheet to choose a week, month, quarter, half year, year, all time or any two days
@Component({
  selector: 'app-range-picker',
  templateUrl: './range-picker.component.html',
  styleUrls: ['./range-picker.component.scss'],
  imports: [IonButton, IonIcon, IonItem, IonModal, IonDatetime],
})
export class RangePickerComponent implements OnInit {
  /** The kind of range it opens on */
  initial = input<RangeKind>('month');
  /** The day the first loan was given, for "Since 15 Jul 2026" */
  allTimeFrom = input<string | null | undefined>(null);
  rangeChange = output<PickedRange>();

  readonly names = NAMES;
  readonly presets = PRESETS;
  readonly uid = `range-${nextId++}`;

  kind = signal<RangeKind>('month');
  // First day of the week, month, quarter, half year or year on show
  private anchor = signal(periodStart('month', localToday()));
  private customFrom = signal(addDays(localToday(), -29));
  private customTo = signal(localToday());

  sheetOpen = signal(false);
  // A custom range being set in the sheet; it applies with "Show"
  editingCustom = signal(false);
  draftFrom = signal('');
  draftTo = signal('');

  allTimeLabel = computed(() => {
    const first = this.allTimeFrom();
    return first ? `Since ${showDay(first, 'd MMM y')}` : 'From the first loan';
  });

  picked = computed<PickedRange>(() => {
    const kind = this.kind();
    if (kind === 'all') return { kind, label: this.allTimeLabel(), compare: null };
    if (kind === 'custom') {
      const from = this.customFrom();
      const to = this.customTo();
      const days = daysBetween(from, to) + 1;
      const before = { from: addDays(from, -days), to: addDays(from, -1) };
      return { kind, from, to, label: spanLabel(from, to), compare: { ...before, label: spanLabel(before.from, before.to) } };
    }
    const from = this.anchor();
    const previous = shiftPeriod(kind, from, -1);
    return {
      kind,
      from,
      to: periodEnd(kind, from),
      label: describePeriod(kind, from),
      compare: { from: previous, to: periodEnd(kind, previous), label: describePeriod(kind, previous) },
    };
  });

  /** Week to year step back and forward; all time and a custom range don't */
  steps = computed(() => this.kind() !== 'all' && this.kind() !== 'custom');

  constructor() {
    addIcons({
      'chevron-back': chevronBack, 'chevron-forward': chevronForward, 'chevron-down': chevronDown, checkmark,
      'calendar-outline': calendarOutline,
    });
  }

  ngOnInit() {
    const kind = this.initial();
    this.kind.set(kind);
    if (kind !== 'all' && kind !== 'custom') this.anchor.set(periodStart(kind, localToday()));
    this.emit();
  }

  /** How a choice reads in the sheet: the period on show for the chosen kind, the one holding today for the rest */
  presetLabel(kind: PeriodKind): string {
    return describePeriod(kind, kind === this.kind() ? this.anchor() : periodStart(kind, localToday()));
  }

  customLabel(): string {
    return this.kind() === 'custom' ? this.picked().label : 'Any two days';
  }

  open() {
    this.editingCustom.set(this.kind() === 'custom');
    this.draftFrom.set(this.customFrom());
    this.draftTo.set(this.customTo());
    this.sheetOpen.set(true);
  }

  choose(kind: RangeKind) {
    if (kind === 'custom') {
      this.editingCustom.set(true);
      return;
    }
    this.sheetOpen.set(false);
    if (kind === this.kind()) return;
    this.kind.set(kind);
    // A week, month, quarter, half year or year opens on the one holding today
    if (kind !== 'all') this.anchor.set(periodStart(kind, localToday()));
    this.emit();
  }

  setDraft(edge: 'from' | 'to', value: string | string[] | null | undefined) {
    if (typeof value !== 'string') return;
    (edge === 'from' ? this.draftFrom : this.draftTo).set(value.slice(0, 10));
  }

  applyCustom() {
    // Either way round, the earlier day starts the range
    const [from, to] = [this.draftFrom(), this.draftTo()].sort();
    this.customFrom.set(from);
    this.customTo.set(to);
    this.kind.set('custom');
    this.sheetOpen.set(false);
    this.emit();
  }

  step(delta: number) {
    this.anchor.set(shiftPeriod(this.kind() as PeriodKind, this.anchor(), delta));
    this.emit();
  }

  showDay(key: string, format: string): string {
    return showDay(key, format);
  }

  private emit() {
    this.rangeChange.emit(this.picked());
  }
}
