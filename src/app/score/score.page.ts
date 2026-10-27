import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon, IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircle, arrowDown, arrowUp, checkmarkCircle, chevronDown, chevronUp, removeOutline, thumbsUpOutline, warningOutline
} from 'ionicons/icons';
import { ApiService } from '../services/api.service';
import { showDay } from '../utils/periods';
import { PickedRange, RangePickerComponent } from '../components/range-picker/range-picker.component';

interface ScorePart {
  key: string;
  name: string;
  weight: number;
  score: number | null;
  points: number | null;
  summary: string;
  /** Points now less points in the period compared with; null when either couldn't be scored */
  change: number | null;
}
interface Reason { text: string; details: string[]; }
interface ScoreData {
  from: string;
  to: string;
  measuredTo?: string;
  firstLoanDay: string;
  notStarted?: boolean;
  total?: number | null;
  label?: string | null;
  parts?: ScorePart[];
  helping?: Reason[];
  hurting?: Reason[];
  previous?: { from: string; to: string; total: number; label: string } | null;
  settings: { targetYearlyRate: number; graceDays: number };
}

// The label's chip and icon: never colour alone
const LABEL_LOOK: Record<string, { chip: string; icon: string }> = {
  'Strong': { chip: 'chip-success', icon: 'checkmark-circle' },
  'Good': { chip: 'chip-info', icon: 'thumbs-up-outline' },
  'Needs attention': { chip: 'chip-warning', icon: 'alert-circle' },
  'At risk': { chip: 'chip-danger', icon: 'warning-outline' },
};

// How the business did over a range of days, out of 100, and why. Opened from the dashboard's header and
// worked out only while open, so nothing else in the app waits on it.
@Component({
  selector: 'app-score',
  templateUrl: './score.page.html',
  styleUrls: ['./score.page.scss'],
  imports: [
    DecimalPipe, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon, IonSpinner, RangePickerComponent
  ],
})
export class ScorePage {
  private api = inject(ApiService);

  // The range picked, with the period to compare it with; set by the range picker, which starts on this month
  range = signal<PickedRange | null>(null);

  data = signal<ScoreData | null>(null);
  loading = signal(false);
  error = signal('');
  showHow = signal(false);
  private requestId = 0;

  /** The change on the period before, when there is one */
  change = computed(() => {
    const d = this.data();
    if (!d?.previous || d.total === null || d.total === undefined) return null;
    return { points: d.total - d.previous.total, label: this.range()?.compare?.label || '' };
  });

  constructor() {
    addIcons({
      'checkmark-circle': checkmarkCircle, 'alert-circle': alertCircle, 'thumbs-up-outline': thumbsUpOutline,
      'warning-outline': warningOutline, 'arrow-up': arrowUp, 'arrow-down': arrowDown, 'remove-outline': removeOutline,
      'chevron-down': chevronDown, 'chevron-up': chevronUp,
    });
  }

  onRange(range: PickedRange) {
    this.range.set(range);
    this.load();
  }

  load() {
    const range = this.range();
    if (!range) return;
    const id = ++this.requestId;
    this.loading.set(true);
    this.api.getBusinessScore(range, range.compare).subscribe({
      next: (res) => {
        if (id !== this.requestId) return;
        this.data.set(res.data);
        this.error.set('');
        this.loading.set(false);
      },
      error: () => {
        if (id !== this.requestId) return;
        this.error.set('Could not work out the score.');
        this.loading.set(false);
      },
    });
  }

  showDay(key: string, format = 'd MMM y'): string {
    return showDay(key, format);
  }

  /** A change in points, signed and without a trailing .0: +5, −2.3, and a dash for no change */
  signed(change: number): string {
    const size = String(Number(Math.abs(change).toFixed(1)));
    return change > 0 ? `+${size}` : change < 0 ? `−${size}` : '–';
  }

  /** What a part's change says, for screen readers: 5 points up on September 2026 */
  changeText(change: number): string {
    const size = String(Number(Math.abs(change).toFixed(1)));
    const label = this.range()?.compare?.label || 'the period before';
    if (change === 0) return `Same as ${label}`;
    return `${size} ${size === '1' ? 'point' : 'points'} ${change > 0 ? 'up' : 'down'} on ${label}`;
  }

  look(label: string | null | undefined) {
    return LABEL_LOOK[label || ''] || { chip: '', icon: 'remove-outline' };
  }

  /** A part's bar: good from 80 (the same line that sorts it into what's helping), fair from 50 */
  band(score: number | null): string {
    if (score === null) return 'none';
    return score >= 80 ? 'good' : score >= 50 ? 'fair' : 'poor';
  }
}
