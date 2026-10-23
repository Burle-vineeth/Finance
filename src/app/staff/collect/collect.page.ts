import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon, IonSearchbar, IonSegment,
  IonSegmentButton, IonLabel, IonSpinner, IonToast, IonModal, IonItem, IonInput, IonDatetime, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { finalize } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import {
  settingsOutline, close, callOutline, calendarOutline, hourglassOutline, checkmarkCircleOutline,
  alertCircleOutline, informationCircleOutline, cashOutline, checkmarkDoneCircleOutline
} from 'ionicons/icons';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { localToday, newRequestId } from '../../utils/dates';
import { dueBadge } from '../../utils/due-status';
import { slideUpEnter, slideDownLeave } from '../../utils/modal-animations';

interface DueStatus {
  label: string;
  chip: string;
  icon: string;
  // Still to be collected today (due or overdue, nothing collected or sent yet)
  due: boolean;
}

@Component({
  selector: 'app-collect',
  templateUrl: 'collect.page.html',
  styleUrls: ['collect.page.scss'],
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon, IonSearchbar, IonSegment,
    IonSegmentButton, IonLabel, IonSpinner, IonToast, IonModal, IonItem, IonInput, IonDatetime, IonRefresher, IonRefresherContent,
    EmptyStateComponent
  ],
})
export class CollectPage implements OnInit {
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  public authService = inject(AuthService);

  loans: (any & { due: DueStatus })[] = [];
  isLoading = true;
  error = '';
  search = '';
  filter: 'due' | 'all' = 'due';

  // The loan being collected from, and the id that makes resending this submission safe
  selected: any = null;
  private requestId = '';
  form: FormGroup;
  isSaving = false;
  readonly today = localToday();
  readonly slideUpEnter = slideUpEnter;
  readonly slideDownLeave = slideDownLeave;

  showToast = false;
  toastMessage = '';
  toastColor = 'success';

  constructor() {
    addIcons({
      'settings-outline': settingsOutline, close, 'call-outline': callOutline, 'calendar-outline': calendarOutline,
      'hourglass-outline': hourglassOutline, 'checkmark-circle-outline': checkmarkCircleOutline,
      'alert-circle-outline': alertCircleOutline, 'information-circle-outline': informationCircleOutline,
      'cash-outline': cashOutline, 'checkmark-done-circle-outline': checkmarkDoneCircleOutline
    });
    this.form = this.fb.group({
      amount: ['', Validators.required],
      date: [localToday(), Validators.required],
      notes: [''],
    });
  }

  get firstName(): string {
    return (this.authService.user()?.name || '').split(' ')[0];
  }

  get dueCount(): number {
    return this.loans.filter((l) => l.due.due).length;
  }

  get sentTodayCount(): number {
    return this.loans.filter((l) => l.awaitingApproval?.today).length;
  }

  get visibleLoans(): any[] {
    const query = this.search.trim().toLowerCase();
    return this.loans.filter((l) =>
      (this.filter === 'all' || l.due.due)
      && (!query || (l.client?.name || '').toLowerCase().includes(query) || (l.client?.phone || '').includes(query))
    );
  }

  ngOnInit() {
    this.load();
    this.apiService.refresh$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  ionViewWillEnter() {
    this.load();
  }

  load(done?: () => void) {
    this.apiService.getCollectableLoans().pipe(
      finalize(() => done?.())
    ).subscribe({
      next: (res) => {
        this.loans = res.data.map((loan: any) => ({ ...loan, due: this.dueStatus(loan) }));
        this.error = '';
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Could not load loans. Check the connection and pull to refresh.';
        this.isLoading = false;
      }
    });
  }

  refresh(event: any) {
    this.load(() => event.target.complete());
  }

  // The loan's label from its installment schedule; a collection sent today waits for the admin, so it isn't "to collect"
  private dueStatus(loan: any): DueStatus {
    if (loan.awaitingApproval?.today) {
      return { label: 'Sent for approval', chip: 'chip-info', icon: 'hourglass-outline', due: false };
    }
    const badge = dueBadge(loan.schedule);
    return { label: badge.label, chip: badge.chip, icon: badge.icon, due: badge.toCollect };
  }

  openCollect(loan: any) {
    this.selected = loan;
    this.requestId = newRequestId();
    // One installment, or less when that is all that's due (e.g. the rest of a part-paid installment)
    const due = loan.schedule?.amountDue > 0 ? Math.min(loan.schedule.amountDue, loan.installment) : loan.installment;
    this.form.reset({
      amount: due ? Number(due).toLocaleString('en-IN') : '',
      date: localToday(),
      notes: '',
    });
  }

  closeCollect() {
    this.selected = null;
  }

  submit() {
    const amount = Number(String(this.form.value.amount).replace(/,/g, ''));
    if (this.form.invalid || this.isSaving || !this.selected || !(amount > 0)) return;

    this.isSaving = true;
    const loan = this.selected;
    this.apiService.submitCollection({
      loan: loan._id,
      amount,
      date: this.form.value.date,
      notes: (this.form.value.notes || '').trim() || undefined,
      // Same id when the send is retried, so the server keeps only one entry
      requestId: this.requestId,
    }).pipe(
      finalize(() => this.isSaving = false)
    ).subscribe({
      next: () => {
        this.closeCollect();
        this.displayToast(`Sent for approval: ${loan.client?.name}`);
      },
      error: (err) => {
        const message = err.status === 0
          ? 'No connection. Tap Send again – it won\'t be saved twice.'
          : (err.error?.error || err.error?.message || 'Could not send. Please try again.');
        this.displayToast(Array.isArray(message) ? message[0] : message, 'danger');
      }
    });
  }

  formatCurrencyInput(event: any, controlName: string) {
    const value = event.target.value.replace(/[^0-9]/g, '');
    this.form.get(controlName)?.setValue(value ? Number(value).toLocaleString('en-IN') : '', { emitEvent: false });
  }

  trackById(index: number, item: any) {
    return item?._id || index;
  }

  displayToast(message: string, color: string = 'success') {
    this.toastMessage = message;
    this.toastColor = color;
    this.showToast = true;
  }
}
