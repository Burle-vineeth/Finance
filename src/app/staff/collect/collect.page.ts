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
  alertCircleOutline, informationCircleOutline, cashOutline
} from 'ionicons/icons';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { localToday, newRequestId } from '../../utils/dates';

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

  showToast = false;
  toastMessage = '';
  toastColor = 'success';

  constructor() {
    addIcons({
      'settings-outline': settingsOutline, close, 'call-outline': callOutline, 'calendar-outline': calendarOutline,
      'hourglass-outline': hourglassOutline, 'checkmark-circle-outline': checkmarkCircleOutline,
      'alert-circle-outline': alertCircleOutline, 'information-circle-outline': informationCircleOutline,
      'cash-outline': cashOutline
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

  private dueStatus(loan: any): DueStatus {
    if (loan.awaitingApproval?.today) {
      return { label: 'Sent for approval', chip: 'chip-info', icon: 'hourglass-outline', due: false };
    }
    if (loan.isCollectedToday) {
      return { label: 'Collected today', chip: 'chip-success', icon: 'checkmark-circle-outline', due: false };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(loan.nextPaymentDate);
    next.setHours(0, 0, 0, 0);
    const day = next.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    if (next.getTime() < today.getTime()) {
      return { label: `Overdue since ${day}`, chip: 'chip-danger', icon: 'alert-circle-outline', due: true };
    }
    if (next.getTime() === today.getTime()) {
      return { label: 'Due today', chip: 'chip-warning', icon: 'alert-circle-outline', due: true };
    }
    return { label: `Next due ${day}`, chip: '', icon: 'calendar-outline', due: false };
  }

  openCollect(loan: any) {
    this.selected = loan;
    this.requestId = newRequestId();
    this.form.reset({
      amount: loan.installment ? Number(loan.installment).toLocaleString('en-IN') : '',
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
