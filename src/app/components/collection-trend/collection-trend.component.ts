import { AfterViewInit, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { IonLabel, IonSegment, IonSegmentButton, IonSpinner } from '@ionic/angular/standalone';
import { ApiService } from '../../services/api.service';
import { compactRupees } from '../../utils/money';
import { daysBetween, showDay as show, weekStart } from '../../utils/periods';
import { PickedRange, RangePickerComponent } from '../range-picker/range-picker.component';

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

// Daily points while they stay readable (about a quarter), then weekly up to a year, then monthly
const stepFor = (days: number): Step => (days <= 92 ? 'day' : days <= 366 ? 'week' : 'month');

const bucketOf = (key: string, step: Step) => {
  if (step === 'day') return key;
  if (step === 'month') return `${key.slice(0, 7)}-01`;
  return weekStart(key);
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
  imports: [CurrencyPipe, DecimalPipe, IonLabel, IonSegment, IonSegmentButton, IonSpinner, RangePickerComponent],
})
export class CollectionTrendComponent implements AfterViewInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  private measure = viewChild.required<ElementRef<HTMLElement>>('measure');

  readonly chartHeight = CHART_HEIGHT;

  // The range picked, set by the range picker (which starts on this month and reports it straight away)
  range = signal<PickedRange | null>(null);

  data = signal<TrendData | null>(null);
  loading = signal(false);
  error = signal('');
  view = signal<'chart' | 'table'>('chart');
  // The point under the crosshair
  active = signal<number | null>(null);
  private width = signal(0);
  private requestId = 0;

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

  ngAfterViewInit() {
    const element = this.measure().nativeElement;
    const observer = new ResizeObserver(() => this.width.set(element.clientWidth));
    observer.observe(element);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  onRange(range: PickedRange) {
    this.range.set(range);
    this.load();
  }

  load() {
    const range = this.range();
    if (!range) return;
    const { from, to } = range;
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
