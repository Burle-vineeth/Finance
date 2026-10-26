import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonSelect,
  IonSelectOption, IonButton, IonIcon, IonToast, IonList, IonSegment, IonSegmentButton, IonItemSliding, IonItemOptions, IonItemOption, IonSpinner, IonModal, IonDatetime,
  AlertController
} from '@ionic/angular/standalone';
import { finalize } from 'rxjs/operators';
import { ApiService } from '../services/api.service';
import { EmptyStateComponent } from '../components/empty-state/empty-state.component';
import { localToday } from '../utils/dates';
import { CalendarType, PaymentCalendarComponent } from '../components/payment-calendar/payment-calendar.component';
import { arrowUpCircle, arrowDownCircle, trashOutline, arrowDown, arrowUp, receiptOutline, informationCircleOutline, swapHorizontalOutline, walletOutline, calendarOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonSelect,
    IonSelectOption, IonButton, IonIcon, IonToast, IonList, IonSegment, IonSegmentButton, IonItemSliding, IonItemOptions, IonItemOption, IonSpinner, IonModal, IonDatetime,
    EmptyStateComponent, PaymentCalendarComponent
  ]
})
export class Tab3Page implements OnInit {
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private alertController = inject(AlertController);
  private destroyRef = inject(DestroyRef);

  activeLoans: any[] = [];
  transactions: any[] = [];
  // Loan id -> client name for every loan, so the calendar can say who paid (repayments don't carry the client)
  loanNames: Record<string, string> = {};
  
  repaymentForm: FormGroup;
  viewMode: 'collect' | 'calendar' | 'ledger' = 'collect';
  calendarType: CalendarType = 'REPAYMENT';

  // Set while a request is running so a second tap can't send it again
  isSavingRepayment = false;
  deletingId: string | null = null;

  showToast = false;
  toastMessage = '';
  toastColor = 'success';

  constructor() {
    addIcons({
      'arrow-up-circle': arrowUpCircle, 'arrow-down-circle': arrowDownCircle, 'trash-outline': trashOutline,
      'arrow-down': arrowDown, 'arrow-up': arrowUp, 'receipt-outline': receiptOutline,
      'information-circle-outline': informationCircleOutline, 'swap-horizontal-outline': swapHorizontalOutline,
      'wallet-outline': walletOutline, 'calendar-outline': calendarOutline
    });
    this.repaymentForm = this.fb.group({
      loan: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(1)]],
      date: [localToday(), Validators.required]
    });
  }

  ngOnInit() {
    this.loadData();
    this.apiService.refresh$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.loadData();
    });
  }

  ionViewWillEnter() {
    this.loadData();
  }

  loadData() {
    this.loadActiveLoans();
    this.loadLedger();
  }

  loadActiveLoans() {
    this.apiService.getLoans().subscribe({
      next: (res) => {
        const names: Record<string, string> = {};
        res.data.forEach((l: any) => names[l._id] = l.client?.name);
        this.loanNames = names;
        // Filter to only ACTIVE loans
        this.activeLoans = res.data.filter((l: any) => l.status === 'ACTIVE');
      },
      error: (err) => console.error('Failed to load loans', err)
    });
  }

  loadLedger() {
    this.apiService.getTransactions().subscribe({
      next: (res) => {
        this.transactions = res.data;
      },
      error: (err) => console.error('Failed to load transactions', err)
    });
  }

  onLogRepayment() {
    if (this.repaymentForm.invalid || this.isSavingRepayment) return;

    const rawAmount = String(this.repaymentForm.value.amount).replace(/,/g, '');

    const payload = {
      type: 'REPAYMENT',
      loan: this.repaymentForm.value.loan,
      amount: Number(rawAmount),
      date: this.repaymentForm.value.date,
      notes: 'Logged via App'
    };

    this.isSavingRepayment = true;
    this.apiService.addTransaction(payload).pipe(
      finalize(() => this.isSavingRepayment = false)
    ).subscribe({
      next: (res) => {
        this.displayToast('Repayment logged successfully! Dashboard updated.');
        this.repaymentForm.reset({
          date: localToday()
        });
      },
      error: (err) => {
        this.displayToast('Error logging repayment', 'danger');
      }
    });
  }

  formatCurrencyInput(event: any, formGroup: FormGroup, controlName: string) {
    let value = event.target.value.replace(/[^0-9]/g, '');
    if (value) {
      const formatted = Number(value).toLocaleString('en-IN');
      formGroup.get(controlName)?.setValue(formatted, { emitEvent: false });
    } else {
      formGroup.get(controlName)?.setValue('', { emitEvent: false });
    }
  }

  async confirmDeleteTransaction(transactionId: string) {
    if (this.deletingId) return;

    const alert = await this.alertController.create({
      header: 'Undo transaction?',
      message: 'This will completely remove the transaction and reverse any associated loan calculations. Are you sure?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { 
          text: 'Undo', 
          role: 'destructive',
          handler: () => {
            this.onDeleteTransaction(transactionId);
          }
        }
      ]
    });
    await alert.present();
  }

  onDeleteTransaction(id: string) {
    if (this.deletingId) return;

    this.deletingId = id;
    this.apiService.deleteTransaction(id).pipe(
      finalize(() => this.deletingId = null)
    ).subscribe({
      next: () => {
        this.displayToast('Transaction successfully undone.');
      },
      error: (err) => {
        this.displayToast('Error undoing transaction', 'danger');
      }
    });
  }

  trackById(index: number, item: any) {
    return item?._id || item?.id || index;
  }

  formatType(type: string): string {
    if (!type) return '';
    // Sentence case, like the rest of the app: CAPITAL_INJECTION -> Capital injection
    const words = type.replace(/_/g, ' ').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  displayToast(message: string, color: string = 'success') {
    this.toastMessage = message;
    this.toastColor = color;
    this.showToast = true;
  }
}
