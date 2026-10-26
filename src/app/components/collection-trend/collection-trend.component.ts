import { AfterViewInit, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DecimalPipe, formatDate } from '@angular/common';
import {
  IonButton, IonIcon, IonItem, IonLabel, IonModal, IonDatetime, IonSegment, IonSegmentButton, IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, chevronBack, chevronForward } from 'ionicons/icons';
import { ApiService } from '../../services/api.service';
import { localToday } from '../../utils/dates';
import { compactRupees } from '../../utils/money';

type RangeKind = 'all' | 'week' | 'month' | 'quarter' | 'half' | 'year' | 'custom';
type PeriodKind = 'week' | 'month' | 'quarter' | 'half' | 'year';
type Step = 'day' | 'week' | 'month';

interface TrendDay { date: string; expected: number; collected: number; }
interface TrendData { from: string; to: string; today: string; firstLoanDay: string; days: TrendDay[]; }

/** One point on the chart: a day, a week or a month of days */
interface TrendPoint {
  key: string;
  from: string;
  to: string;
  expected: number;
  collected: number;
  /** Starts after today, so nothing can have been collected yet */
  future: boolean;
}

const MONTHS_IN: Record<Exclude<PeriodKind, 'week'>, number> = { month: 1, quarter: 3, half: 6, year: 12 };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Day arithmetic on 'YYYY-MM-DD' keys, in UTC so no time zone or daylight saving shifts a day
const keyOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const partsOf = (key: string) => key.split('-').map(Number) as [number, number, number];
const addDays = (key: string, days: number) => { const [y, m, d] = partsOf(key); return keyOf(y, m - 1, d + days); };
const addMonths = (key: string, months: number) => { const [y, m, d] = partsOf(key); return keyOf(y, m - 1 + months, d); };
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
// For formatDate: the key's day at local midnight, so it prints as that day in any time zone
const localDate = (key: string) => { const [y, m, d] = partsOf(key); return new Date(y, m - 1, d); };
const show = (key: string, format: string) => formatDate(localDate(key), format, 'en-IN');

// The day a period of this kind starts, for the period holding `key` (weeks from Monday; calendar quarters,
// halves and years)
const periodStart = (kind: PeriodKind, key: string) => {
  if (kind === 'week') return bucketOf(key, 'week');
  const [y, m] = partsOf(key);
  const size = MONTHS_IN[kind];
  return keyOf(y, Math.floor((m - 1) / size) * size, 1);
};

// The last day of the period starting on `start`
const periodEnd = (kind: PeriodKind, start: string) =>
  (kind === 'week' ? addDays(start, 6) : addDays(addMonths(start, MONTHS_IN[kind]), -1));

// The start of the period `delta` periods before or after the one starting on `start`
const shiftPeriod = (kind: PeriodKind, start: string, delta: number) =>
  (kind === 'week' ? addDays(start, 7 * delta) : addMonths(start, delta * MONTHS_IN[kind]));

// Daily points while they stay readable (about a quarter), then weekly up to a year, then monthly
const stepFor = (days: number): Step => (days <= 92 ? 'day' : days <= 366 ? 'week' : 'month');

const bucketOf = (key: string, step: Step) => {
  if (step === 'day') return key;
  if (step === 'month') return `${key.slice(0, 7)}-01`;
  // Weeks run Monday to Sunday
  const weekday = (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(key, -weekday);
};

// A round top for the y-axis, close above the highest point, whose half is round too (₹8k, ₹4k)
const niceMax = (value: number) => {
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].map((m) => m * power).find((v) => v >= value) ?? value;
};

const CHART_HEIGHT = 200;
const PAD = { top: 14, right: 10, bottom: 24, left: 46 };

@Component({
  selector: 'app-collection-trend',
  templateUrl: './collection-trend.component.html',
  styleUrls: ['./collection-trend.component.scss'],
  imports: [CurrencyPipe, DecimalPipe, IonButton, IonIcon, IonItem, IonLabel, IonModal, IonDatetime, IonSegment, IonSegmentButton, IonSpinner],
})
export class CollectionTrendComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  private measure = viewChild.required<ElementRef<HTMLElement>>('measure');

  readonly ranges: { kind: RangeKind; label: string }[] = [
    { kind: 'all', label: 'All time' },
    { kind: 'week', label: 'Week' },
    { kind: 'month', label: 'Month' },
    { kind: 'quarter', label: 'Quarter' },
    { kind: 'half', label: 'Half year' },
    { kind: 'year', label: 'Year' },
    { kind: 'custom', label: 'Custom' },
  ];
  readonly chartHeight = CHART_HEIGHT;

  kind = signal<RangeKind>('month');
  // First day of the week, month, quarter, half year or year on show
  private anchor = signal(periodStart('month', localToday()));
  customFrom = signal(addDays(localToday(), -29));
  customTo = signal(localToday());

  data = signal<TrendData | null>(null);
  loading = signal(false);
  error = signal('');
  view = signal<'chart' | 'table'>('chart');
  // The point under the crosshair
  active = signal<number | null>(null);
  private width = signal(0);
  private requestId = 0;

  range = computed<{ from?: string; to?: string }>(() => {
    const kind = this.kind();
    if (kind === 'all') return {};
    if (kind === 'custom') return { from: this.customFrom(), to: this.customTo() };
    const from = this.anchor();
    return { from, to: periodEnd(kind, from) };
  });

  periodLabel = computed(() => {
    const kind = this.kind();
    const { from, to } = this.range();
    if (!from || !to) return '';
    const [y, m] = partsOf(from);
    const months = `${MONTH_NAMES[m - 1]}–${MONTH_NAMES[partsOf(to)[1] - 1]}`;
    // A week across New Year shows both years
    if (kind === 'week') return `${show(from, y === partsOf(to)[0] ? 'd MMM' : 'd MMM y')} – ${show(to, 'd MMM y')}`;
    if (kind === 'month') return show(from, 'MMMM y');
    if (kind === 'quarter') return `Q${Math.floor((m - 1) / 3) + 1} ${y} · ${months}`;
    if (kind === 'half') return `H${m <= 6 ? 1 : 2} ${y} · ${months}`;
    return String(y);
  });

  step = computed<Step>(() => {
    const d = this.data();
    return d ? stepFor(daysBetween(d.from, d.to) + 1) : 'day';
  });

  points = computed<TrendPoint[]>(() => {
    const d = this.data();
    if (!d) return [];
    const step = this.step();
    const points: TrendPoint[] = [];
    for (const day of d.days) {
      const key = bucketOf(day.date, step);
      let point = points[points.length - 1];
      if (!point || point.key !== key) {
        point = { key, from: day.date, to: day.date, expected: 0, collected: 0, future: day.date > d.today };
        points.push(point);
      }
      point.to = day.date;
      point.expected += day.expected;
      point.collected += day.collected;
    }
    return points;
  });

  /** Up to today: what fell due and what came in. After today: what is still to fall due in the range. */
  totals = computed(() => {
    const d = this.data();
    let expected = 0, collected = 0, upcoming = 0;
    for (const day of d?.days || []) {
      if (day.date <= d!.today) {
        expected += day.expected;
        collected += day.collected;
      } else {
        upcoming += day.expected;
      }
    }
    return { expected, collected, upcoming, rate: expected > 0 ? collected / expected : null, hasFuture: upcoming > 0 };
  });

  chart = computed(() => {
    const points = this.points();
    const width = this.width();
    const d = this.data();
    if (!d || !points.length || width < 120) return null;

    const plotWidth = width - PAD.left - PAD.right;
    const plotHeight = CHART_HEIGHT - PAD.top - PAD.bottom;
    const top = niceMax(Math.max(1, ...points.map((p) => Math.max(p.expected, p.collected))));
    const xs = points.map((_, i) => PAD.left + (points.length === 1 ? plotWidth / 2 : (i * plotWidth) / (points.length - 1)));
    const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;
    const path = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)},${y(v).toFixed(1)}`).join('');
    // Nothing is collected in the future, so that line stops at today
    const past = points.filter((p) => !p.future).length;

    const last = points.length - 1;
    const labelAt = [...new Set([0, Math.round(last / 2), last])];
    return {
      width,
      left: PAD.left,
      right: width - PAD.right,
      baseline: PAD.top + plotHeight,
      xs,
      expectedY: points.map((p) => y(p.expected)),
      collectedY: points.map((p) => y(p.collected)),
      expectedPath: path(points.map((p) => p.expected)),
      collectedPath: past ? path(points.slice(0, past).map((p) => p.collected)) : '',
      ticks: [0, top / 2, top].map((v) => ({ y: y(v), label: compactRupees(v) })),
      xLabels: labelAt.map((i) => ({
        x: xs[i],
        label: this.shortLabel(points[i]),
        anchor: points.length === 1 ? 'middle' : i === 0 ? 'start' : i === last ? 'end' : 'middle',
      })),
      // A hairline where today falls, when the range runs on past it
      todayX: past > 0 && past < points.length ? xs[past - 1] : null,
    };
  });

  /** The crosshair's readout, kept inside the chart's edges */
  tooltip = computed(() => {
    const i = this.active();
    const chart = this.chart();
    if (i === null || !chart) return null;
    const point = this.points()[i];
    const boxWidth = 168;
    return {
      point,
      title: this.longLabel(point),
      left: Math.min(Math.max(chart.xs[i] - boxWidth / 2, 0), chart.width - boxWidth),
      width: boxWidth,
    };
  });

  /** Rows for the table view: the points where anything was due or came in */
  rows = computed(() => this.points().filter((p) => p.expected > 0 || p.collected > 0));

  constructor() {
    addIcons({ 'chevron-back': chevronBack, 'chevron-forward': chevronForward, 'calendar-outline': calendarOutline });
  }

  ngOnInit() {
    this.load();
  }

  ngAfterViewInit() {
    const element = this.measure().nativeElement;
    const observer = new ResizeObserver(() => this.width.set(element.clientWidth));
    observer.observe(element);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  load() {
    const { from, to } = this.range();
    // Only the latest request draws, however the responses arrive
    const id = ++this.requestId;
    this.loading.set(true);
    this.api.getCollectionTrend(from, to).subscribe({
      next: (res) => {
        if (id !== this.requestId) return;
        this.data.set(res.data);
        this.active.set(null);
        this.error.set('');
        this.loading.set(false);
      },
      error: () => {
        if (id !== this.requestId) return;
        this.error.set('Could not load the chart.');
        this.loading.set(false);
      },
    });
  }

  setKind(kind: RangeKind) {
    if (!kind || kind === this.kind()) return;
    this.kind.set(kind);
    // Week, month, quarter, half year and year open on the one holding today
    if (kind !== 'all' && kind !== 'custom') this.anchor.set(periodStart(kind, localToday()));
    this.load();
  }

  shift(delta: number) {
    this.anchor.set(shiftPeriod(this.kind() as PeriodKind, this.anchor(), delta));
    this.load();
  }

  setCustom(edge: 'from' | 'to', value: string | string[] | null | undefined) {
    if (typeof value !== 'string') return;
    const day = value.slice(0, 10);
    if (edge === 'from') this.customFrom.set(day); else this.customTo.set(day);
    // Keep the range the right way round
    if (this.customFrom() > this.customTo()) {
      if (edge === 'from') this.customTo.set(day); else this.customFrom.set(day);
    }
    this.load();
  }

  allTimeLabel(): string {
    const d = this.data();
    return d && this.kind() === 'all' ? `Since ${show(d.from, 'd MMM y')}` : 'All time';
  }

  showDay(key: string, format = 'd MMM y'): string {
    return show(key, format);
  }

  stepNote(): string {
    const step = this.step();
    if (step === 'day') return 'Each point is one day.';
    if (step === 'week') return 'Each point is one week, Monday to Sunday.';
    return 'Each point is one month.';
  }

  shortLabel(point: TrendPoint): string {
    return this.step() === 'month' ? show(point.from, 'MMM yy') : show(point.from, 'd MMM');
  }

  longLabel(point: TrendPoint): string {
    const step = this.step();
    if (step === 'day') return show(point.from, 'EEE, d MMM y');
    if (step === 'month') return show(point.from, 'MMMM y');
    return point.from === point.to ? show(point.from, 'd MMM y') : `${show(point.from, 'd MMM')} – ${show(point.to, 'd MMM y')}`;
  }

  // The crosshair snaps to the nearest point under the finger or pointer
  track(event: PointerEvent) {
    const chart = this.chart();
    if (!chart) return;
    const box = (event.currentTarget as Element).getBoundingClientRect();
    const x = event.clientX - box.left;
    let nearest = 0;
    chart.xs.forEach((px, i) => { if (Math.abs(px - x) < Math.abs(chart.xs[nearest] - x)) nearest = i; });
    this.active.set(nearest);
  }

  clearTrack(event: PointerEvent) {
    // A finger lifting keeps the readout on screen; a mouse leaving clears it
    if (event.pointerType === 'mouse') this.active.set(null);
  }

  moveWithKeys(event: KeyboardEvent) {
    const count = this.points().length;
    if (!count) return;
    const current = this.active();
    if (event.key === 'ArrowRight') this.active.set(current === null ? 0 : Math.min(count - 1, current + 1));
    else if (event.key === 'ArrowLeft') this.active.set(current === null ? count - 1 : Math.max(0, current - 1));
    else if (event.key === 'Escape') this.active.set(null);
    else return;
    event.preventDefault();
  }
}
