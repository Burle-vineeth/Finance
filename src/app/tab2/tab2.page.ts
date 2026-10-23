import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonItem, IonLabel, IonInput, IonSelect,
  IonSelectOption, IonButton, IonIcon, IonToast, IonSegment, IonSegmentButton, IonModal, IonButtons, IonSpinner, IonDatetime
} from '@ionic/angular/standalone';
import { finalize } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import {
  arrowUpCircle, arrowDownCircle, documentTextOutline, walletOutline, cashOutline, chevronForward, arrowBack, call,
  arrowDown, arrowUp, receiptOutline, personAddOutline, callOutline, locationOutline, calendarOutline,
  alertCircleOutline, checkmarkCircleOutline, checkmarkDoneCircleOutline, createOutline
} from 'ionicons/icons';
import { ApiService } from '../services/api.service';
import { EmptyStateComponent } from '../components/empty-state/empty-state.component';
import { PaymentCalendarComponent } from '../components/payment-calendar/payment-calendar.component';
import { slideUpEnter, slideDownLeave } from '../utils/modal-animations';
import { dueBadge } from '../utils/due-status';
import { localToday, localDay } from '../utils/dates';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonItem, IonLabel, IonInput, IonSelect,
    IonSelectOption, IonButton, IonIcon, IonToast, IonSegment, IonSegmentButton, IonModal, IonButtons, IonSpinner, IonDatetime,
    EmptyStateComponent, PaymentCalendarComponent
  ]
})
export class Tab2Page implements OnInit {
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  viewMode: 'forms' | 'clients' | 'capital' | 'loans' = 'forms';


  clients: any[] = [];
  allLoans: any[] = [];
  capitalTransactions: any[] = [];
  loanTransactionsMap: { [key: string]: any[] } = {};
  
  capitalFilter: 'CAPITAL_INJECTION' | 'CAPITAL_WITHDRAWAL' | 'BUSINESS_EXPENSE' = 'CAPITAL_INJECTION';
  loanFilter: 'ACTIVE' | 'CLOSED' | 'DEFAULTED' = 'ACTIVE';
  
  get filteredCapital() {
    return this.capitalTransactions.filter(t => t.type === this.capitalFilter);
  }

  get filteredLoans() {
    return this.allLoans.filter(l => l.status === this.loanFilter);
  }

  selectedLoan: any = null;
  isModalOpen = false;
  historyView: 'calendar' | 'list' = 'calendar';
  readonly slideUpEnter = slideUpEnter;
  readonly slideDownLeave = slideDownLeave;

  openLoanDetails(loan: any) {
    this.selectedLoan = loan;
    this.isModalOpen = true;
  }

  closeLoanDetails() {
    this.isModalOpen = false;
    this.selectedLoan = null;
  }

  getLoanDurationString(loan: any): string {
    if (!loan) return '';
    const start = new Date(loan.collectionStartDate || loan.startDate);
    let end = new Date();

    if (loan.status === 'CLOSED' || loan.status === 'DEFAULTED') {
      if (loan.resolvedAt) {
        end = new Date(loan.resolvedAt);
      } else {
        const txs = this.getLoanTransactions(loan._id || loan.id);
        if (txs && txs.length > 0) {
          end = new Date(txs[0].date); // txs are sorted by date desc
        } else {
          end = new Date(loan.updatedAt || new Date());
        }
      }
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} Days`;
  }

  getCollectionPercentage(loan: any): number {
    if (!loan || !loan.expectedReturnAmount) return 0;
    return (loan.totalRepaid || 0) / loan.expectedReturnAmount;
  }

  getLoanTransactions(loanId: string | undefined): any[] {
    if (!loanId) return [];
    return this.loanTransactionsMap[loanId] || [];
  }

  getRepaymentCount(loanId: string | undefined): number {
    return this.getLoanTransactions(loanId).filter(t => t.type === 'REPAYMENT').length;
  }

  clientForm: FormGroup;
  loanForm: FormGroup;
  capitalForm: FormGroup;

  // Set while a request is running so a second tap can't send it again
  isSavingCapital = false;
  isSavingClient = false;
  isSavingLoan = false;

  showToast = false;
  toastMessage = '';
  toastColor = 'success';

  constructor() {
    addIcons({ 
      'arrow-up-circle': arrowUpCircle, 
      'arrow-down-circle': arrowDownCircle,
      'document-text-outline': documentTextOutline,
      'wallet-outline': walletOutline,
      'cash-outline': cashOutline,
      'chevron-forward': chevronForward,
      'arrow-back': arrowBack,
      'call': call,
      'arrow-down': arrowDown,
      'arrow-up': arrowUp,
      'receipt-outline': receiptOutline,
      'person-add-outline': personAddOutline,
      'call-outline': callOutline,
      'location-outline': locationOutline,
      'calendar-outline': calendarOutline,
      'alert-circle-outline': alertCircleOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'checkmark-done-circle-outline': checkmarkDoneCircleOutline,
      'create-outline': createOutline
    });

    this.clientForm = this.fb.group({
      name: ['', Validators.required],
      phone: ['', Validators.required],
      address: [''],
    });

    this.loanForm = this.fb.group({
      client: ['', Validators.required],
      principalAmount: ['', [Validators.required, Validators.min(1)]],
      expectedReturnAmount: ['', [Validators.required, Validators.min(1)]],
      paymentFrequency: ['DAILY', Validators.required],
      durationDays: ['', [Validators.required, Validators.min(1)]],
      startDate: [localToday(), Validators.required],
      collectionStartDate: [''],
    });

    this.capitalForm = this.fb.group({
      type: ['CAPITAL_INJECTION', Validators.required],
      amount: ['', [Validators.required, Validators.min(1)]],
      notes: [''],
      date: [localToday(), Validators.required]
    });
  }

  ngOnInit() {
    this.loadAllData();
    this.apiService.refresh$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.loadAllData();
    });
  }

  ionViewWillEnter() {
    this.loadAllData();
  }

  loadAllData() {
    this.apiService.getClients().subscribe({
      next: (res) => this.clients = res.data,
      error: (err) => console.error(err)
    });

    this.apiService.getLoans().subscribe({
      // Active loans get their label (overdue, due today, paid ahead...) from their installment schedule
      next: (res) => {
        this.allLoans = res.data.map((loan: any) => ({ ...loan, due: loan.schedule ? dueBadge(loan.schedule) : null }));
        // Keep an open Loan details showing the fresh copy (e.g. after its details were edited)
        if (this.selectedLoan) {
          this.selectedLoan = this.allLoans.find((l) => l._id === this.selectedLoan._id) || this.selectedLoan;
        }
      },
      error: (err) => console.error(err)
    });

    this.apiService.getTransactions().subscribe({
      next: (res) => {
        this.capitalTransactions = res.data.filter((t: any) => 
          t.type === 'CAPITAL_INJECTION' || t.type === 'CAPITAL_WITHDRAWAL' || t.type === 'BUSINESS_EXPENSE'
        );
        
        this.loanTransactionsMap = {};
        res.data.forEach((t: any) => {
          if (t.loan) {
            const loanId = t.loan._id || t.loan;
            if (!this.loanTransactionsMap[loanId]) {
              this.loanTransactionsMap[loanId] = [];
            }
            this.loanTransactionsMap[loanId].push(t);
          }
        });
      },
      error: (err) => console.error(err)
    });
  }

  onManageCapital() {
    if (this.capitalForm.invalid || this.isSavingCapital) return;

    const payload = { ...this.capitalForm.value };
    payload.amount = Number(String(payload.amount).replace(/,/g, ''));

    this.isSavingCapital = true;
    this.apiService.addTransaction(payload).pipe(
      finalize(() => this.isSavingCapital = false)
    ).subscribe({
      next: (res) => {
        this.displayToast('Transaction logged!');
        this.capitalForm.reset({ 
          type: 'CAPITAL_INJECTION',
          date: localToday()
        });
      },
      error: (err) => {
        this.displayToast('Error logging capital', 'danger');
      }
    });
  }

  onCreateClient() {
    if (this.clientForm.invalid || this.isSavingClient) return;

    this.isSavingClient = true;
    this.apiService.addClient(this.clientForm.value).pipe(
      finalize(() => this.isSavingClient = false)
    ).subscribe({
      next: (res) => {
        this.displayToast('Client created successfully!');
        this.clientForm.reset();
      },
      error: (err) => {
        this.displayToast('Error creating client', 'danger');
      }
    });
  }

  onDisburseLoan() {
    if (this.loanForm.invalid || this.isSavingLoan) return;

    const payload = { ...this.loanForm.value };
    payload.principalAmount = Number(String(payload.principalAmount).replace(/,/g, ''));
    payload.expectedReturnAmount = Number(String(payload.expectedReturnAmount).replace(/,/g, ''));

    this.isSavingLoan = true;
    this.apiService.addLoan(payload).pipe(
      finalize(() => this.isSavingLoan = false)
    ).subscribe({
      next: (res) => {
        this.displayToast('Loan disbursed successfully!');
        this.loanForm.reset({ 
          paymentFrequency: 'DAILY',
          startDate: localToday(),
          collectionStartDate: ''
        });
      },
      error: (err) => {
        let msg = 'Error disbursing loan';
        if (err.error?.error) {
          msg = Array.isArray(err.error.error) ? err.error.error[0] : err.error.error;
        }
        this.displayToast(msg, 'danger');
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

  trackById(index: number, item: any) {
    return item?._id || item?.id || index;
  }

  formatType(type: string): string {
    if (!type) return '';
    return type
      .replace(/_/g, ' ')
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
  }

  // --- Correct a loan's details: client, disbursement date, collection start date ---
  editingLoan: any = null;
  editForm = { client: '', startDate: '', collectionStartDate: '' };
  // The server's review of the edit: what changes, and the loan's schedule before and after
  editPreview: any = null;
  isPreviewingEdit = false;
  isSavingEdit = false;
  readonly maxDate = localToday();
  readonly editFieldLabels: Record<string, string> = {
    client: 'Client', startDate: 'Disbursement date', collectionStartDate: 'Collection start date',
  };

  openEdit() {
    const loan = this.selectedLoan;
    if (!loan) return;
    this.editingLoan = loan;
    this.editForm = {
      client: loan.client?._id || '',
      startDate: localDay(loan.startDate),
      collectionStartDate: loan.collectionStartDate ? localDay(loan.collectionStartDate) : '',
    };
    this.editPreview = null;
  }

  closeEdit() {
    this.editingLoan = null;
    this.editPreview = null;
  }

  private editChanges() {
    return {
      client: this.editForm.client,
      startDate: this.editForm.startDate,
      collectionStartDate: this.editForm.collectionStartDate || null,
    };
  }

  reviewEdit() {
    if (!this.editingLoan || this.isPreviewingEdit) return;
    this.isPreviewingEdit = true;
    this.apiService.previewLoanEdit(this.editingLoan._id, this.editChanges()).pipe(
      finalize(() => this.isPreviewingEdit = false)
    ).subscribe({
      next: (res) => {
        if (!res.data.changes.length) {
          this.displayToast('Nothing has changed', 'medium');
          return;
        }
        const s = res.data.schedule;
        this.editPreview = { ...res.data, badges: s ? { before: dueBadge(s.before), after: dueBadge(s.after) } : null };
      },
      error: (err) => this.displayToast(this.errorText(err, 'Could not check the changes'), 'danger')
    });
  }

  saveEdit() {
    if (!this.editingLoan || this.isSavingEdit) return;
    this.isSavingEdit = true;
    this.apiService.updateLoan(this.editingLoan._id, this.editChanges()).pipe(
      finalize(() => this.isSavingEdit = false)
    ).subscribe({
      next: () => {
        this.closeEdit();
        this.displayToast('Loan details updated');
      },
      error: (err) => this.displayToast(this.errorText(err, 'Could not save the changes'), 'danger')
    });
  }

  // A date picker returns the picked day, possibly with a time; keep only YYYY-MM-DD
  onEditDate(field: 'startDate' | 'collectionStartDate', value: any) {
    this.editForm[field] = typeof value === 'string' ? value.substring(0, 10) : (field === 'startDate' ? this.editForm.startDate : '');
  }

  private errorText(err: any, fallback: string): string {
    const error = err?.error?.error ?? err?.error?.message;
    return (Array.isArray(error) ? error[0] : error) || fallback;
  }

  displayToast(message: string, color: string = 'success') {
    this.toastMessage = message;
    this.toastColor = color;
    this.showToast = true;
  }
}
