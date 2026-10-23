import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
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
import { ApiService, LoanEdit } from '../services/api.service';
import { EmptyStateComponent } from '../components/empty-state/empty-state.component';
import { PaymentCalendarComponent, CalendarMarker } from '../components/payment-calendar/payment-calendar.component';
import { InstallmentPlanEditorComponent } from '../components/installment-plan-editor/installment-plan-editor.component';
import { PlanRow, checkPlan, planPayload, planRows, planProgress, samePlan } from '../utils/custom-installments';
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
    EmptyStateComponent, PaymentCalendarComponent, InstallmentPlanEditorComponent
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
    this.showWholePlan = false;
    this.isModalOpen = true;
  }

  // --- A loan's custom installment plan in Loan details ---
  showWholePlan = false;
  // Worked out once per loan copy (a reload brings a new copy), not on every change detection
  private planView: { loan: any; rows: ReturnType<typeof planProgress>; markers: CalendarMarker[] } | null = null;

  private planViewOf(loan: any) {
    let view = this.planView;
    if (view?.loan !== loan) {
      const plan = loan?.customInstallments || [];
      view = this.planView = {
        loan,
        rows: plan.length ? planProgress(plan, loan.totalRepaid || 0, loan.schedule?.today || localToday()) : [],
        markers: [
          { date: loan?.startDate, label: 'Disbursed' },
          { date: loan?.collectionStartDate, label: 'Collection start' },
          ...plan.map((row: any) => ({ date: row.date, label: 'Installment due' })),
        ],
      };
    }
    return view!;
  }

  planProgressOf(loan: any) {
    return this.planViewOf(loan).rows;
  }

  /** A long plan shows a few installments around the first unpaid one until "Show all" */
  visiblePlanRows(loan: any) {
    const rows = this.planViewOf(loan).rows;
    if (this.showWholePlan || rows.length <= 12) return rows;
    const firstUnpaid = rows.findIndex((row) => row.state !== 'paid');
    const from = Math.max(0, Math.min((firstUnpaid < 0 ? rows.length : firstUnpaid) - 2, rows.length - 10));
    return rows.slice(from, from + 10);
  }

  calendarMarkers(loan: any): CalendarMarker[] {
    return this.planViewOf(loan).markers;
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
      // REGULAR: an installment and/or a duration; CUSTOM: a custom installment plan (newPlan), each with its own date and amount
      repayment: ['REGULAR'],
      durationDays: ['', [Validators.min(1)]],
      // Set by hand, or left blank to be worked out from the duration; one of the two is needed
      installment: [''],
      startDate: [localToday(), Validators.required],
      collectionStartDate: [''],
    }, {
      validators: (group: AbstractControl) => {
        const { installment, durationDays, repayment } = group.value;
        if (repayment === 'CUSTOM') return null;
        return String(installment ?? '').replace(/,/g, '') || durationDays ? null : { installmentOrDuration: true };
      }
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

  // The custom installment plan of the loan being created
  newPlan: PlanRow[] = [];

  get isCustomPlan(): boolean {
    return this.loanForm.value.repayment === 'CUSTOM';
  }

  /** Whether the form can be sent: everything filled in, and with a custom plan, a good one */
  get canDisburse(): boolean {
    if (this.loanForm.invalid || this.clients.length === 0 || this.isSavingLoan) return false;
    if (!this.isCustomPlan) return true;
    return checkPlan(this.newPlan, this.toNumber(this.loanForm.value.expectedReturnAmount), this.newLoanStart).ok;
  }

  onDisburseLoan() {
    if (!this.canDisburse) return;

    const { repayment, ...payload } = this.loanForm.value;
    payload.principalAmount = Number(String(payload.principalAmount).replace(/,/g, ''));
    payload.expectedReturnAmount = Number(String(payload.expectedReturnAmount).replace(/,/g, ''));
    if (repayment === 'CUSTOM') {
      // The plan sets the dates and amounts, so the loan has no duration, installment or collection start date
      payload.customInstallments = planPayload(this.newPlan);
      delete payload.installment;
      delete payload.durationDays;
      delete payload.collectionStartDate;
    } else {
      // Leave out what wasn't filled in: no installment means "work it out", no duration means "until repaid"
      const installment = String(payload.installment ?? '').replace(/,/g, '');
      if (installment) payload.installment = Number(installment); else delete payload.installment;
      if (payload.durationDays === '' || payload.durationDays === null || payload.durationDays === undefined) delete payload.durationDays;
      else payload.durationDays = Number(payload.durationDays);
    }

    this.isSavingLoan = true;
    this.apiService.addLoan(payload).pipe(
      finalize(() => this.isSavingLoan = false)
    ).subscribe({
      next: (res) => {
        this.displayToast('Loan disbursed successfully!');
        this.loanForm.reset({ 
          paymentFrequency: 'DAILY',
          repayment: 'REGULAR',
          installment: '',
          startDate: localToday(),
          collectionStartDate: ''
        });
        this.newPlan = [];
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

  periodName(frequency: string): string {
    return frequency === 'WEEKLY' ? 'week' : frequency === 'MONTHLY' ? 'month' : 'day';
  }

  /** What the loan form will create, worked out as the server does (it checks again when saving) */
  get loanPlanHint(): { text: string; warn: boolean } | null {
    const v = this.loanForm.value;
    return this.planHint(this.toNumber(v.expectedReturnAmount), this.toNumber(v.installment), Number(v.durationDays) || 0,
      v.paymentFrequency, 'Set an installment, a duration, or both.');
  }

  /** The same for the installment in Edit loan details */
  get editPlanHint(): { text: string; warn: boolean } | null {
    const loan = this.editingLoan;
    if (!loan) return null;
    return this.planHint(loan.expectedReturnAmount, this.toNumber(this.editForm.installment), Number(this.editForm.durationDays) || 0,
      loan.paymentFrequency, 'A loan without a duration needs an installment.');
  }

  /** The new loan's disbursement day, 'YYYY-MM-DD' (the calendar can return a time with it) */
  get newLoanStart(): string {
    return String(this.loanForm.value.startDate || '').substring(0, 10);
  }

  toNumber(value: any): number {
    return Number(String(value ?? '').replace(/,/g, '')) || 0;
  }

  // The installments a loan gets from its expected return, installment (0: none set) and duration (0: none)
  private planHint(expected: number, installment: number, days: number, frequency: string, blankText: string): { text: string; warn: boolean } | null {
    if (!expected) return null;
    const period = this.periodName(frequency);
    const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    const count = !days ? 0 : frequency === 'WEEKLY' ? Math.ceil(days / 7) : frequency === 'MONTHLY' ? Math.ceil(days / 30) : days;

    if (installment > 0) {
      if (installment > expected) return { text: 'The installment can\'t be more than the expected return.', warn: true };
      if (count && installment * count < expected - 0.005) {
        const needed = Math.ceil((expected / count) * 100) / 100;
        return { text: `Too small for ${days} days: needs at least ${rupees(needed)} per ${period}.`, warn: true };
      }
      const full = Math.floor((expected + 0.005) / installment);
      const remainder = Math.round((expected - full * installment) * 100) / 100;
      const total = remainder >= 1 ? full + 1 : full;
      const last = remainder >= 1 ? `, the last ${rupees(remainder)}` : '';
      return { text: `${total} installments of ${rupees(installment)} per ${period}${last}${days ? '' : ' · runs until repaid'}.`, warn: false };
    }
    if (count) {
      return { text: `${rupees(Math.round((expected / count) * 100) / 100)} per ${period}, worked out from ${days} days (${count} installments).`, warn: false };
    }
    return { text: blankText, warn: true };
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
  editForm = { client: '', startDate: '', collectionStartDate: '', installment: '', durationDays: '' as string | number };
  // REGULAR: tenure and installment; CUSTOM: a custom installment plan (editPlan)
  editMode: 'REGULAR' | 'CUSTOM' = 'REGULAR';
  editPlan: PlanRow[] = [];
  private editPlanAtOpen: PlanRow[] = [];
  private editDurationAtOpen = '';
  // The installment as the form opened, to send it only when it was changed
  private editInstallmentAtOpen = '';
  // The server's review of the edit: what changes, and the loan's schedule before and after
  editPreview: any = null;
  isPreviewingEdit = false;
  isSavingEdit = false;
  readonly maxDate = localToday();
  readonly editFieldLabels: Record<string, string> = {
    client: 'Client', startDate: 'Disbursement date', collectionStartDate: 'Collection start date', installment: 'Installment', durationDays: 'Tenure',
    customInstallments: 'Repayment plan',
  };

  openEdit() {
    const loan = this.selectedLoan;
    if (!loan) return;
    this.editingLoan = loan;
    const hasPlan = Boolean(loan.customInstallments?.length);
    this.editForm = {
      client: loan.client?._id || '',
      startDate: localDay(loan.startDate),
      collectionStartDate: loan.collectionStartDate ? localDay(loan.collectionStartDate) : '',
      // A plan loan's installment is only the plan's average, so moving it off the plan starts from blank
      installment: !hasPlan && loan.expectedDailyMonthlyPayment ? Number(loan.expectedDailyMonthlyPayment).toLocaleString('en-IN') : '',
      durationDays: loan.durationDays ? String(loan.durationDays) : '',
    };
    this.editMode = hasPlan ? 'CUSTOM' : 'REGULAR';
    this.editPlanAtOpen = planRows(loan.customInstallments);
    this.editPlan = this.editPlanAtOpen.slice();
    this.editDurationAtOpen = String(this.editForm.durationDays);
    this.editInstallmentAtOpen = this.editForm.installment;
    this.editPreview = null;
  }

  closeEdit() {
    this.editingLoan = null;
    this.editPreview = null;
  }

  private get editHadPlan(): boolean {
    return Boolean(this.editingLoan?.customInstallments?.length);
  }

  /** In custom plan mode, whether the plan is good (by the same rules as the server) */
  get editPlanOk(): boolean {
    return this.editMode !== 'CUSTOM' || checkPlan(this.editPlan, this.editingLoan?.expectedReturnAmount || 0, this.editForm.startDate).ok;
  }

  private editChanges(): LoanEdit {
    // A plan sets the loan's dates and amounts: only a new or changed plan is sent, and no collection start date
    if (this.editMode === 'CUSTOM') {
      const changes: LoanEdit = { client: this.editForm.client, startDate: this.editForm.startDate };
      if (!this.editHadPlan || !samePlan(this.editPlan, this.editPlanAtOpen)) changes.customInstallments = planPayload(this.editPlan);
      return changes;
    }
    const changes: LoanEdit = {
      client: this.editForm.client,
      startDate: this.editForm.startDate,
      collectionStartDate: this.editForm.collectionStartDate || null,
    };
    // Off a plan: back to a tenure and an installment, both as entered (a blank installment comes from the tenure)
    if (this.editHadPlan) {
      const amount = String(this.editForm.installment).replace(/,/g, '');
      const days = String(this.editForm.durationDays ?? '').trim();
      return { ...changes, customInstallments: null, installment: amount ? Number(amount) : '', durationDays: days ? Number(days) : '' };
    }
    // Only a changed installment is sent: blank means "work it out from the duration" again
    if (this.editForm.installment !== this.editInstallmentAtOpen) {
      const amount = String(this.editForm.installment).replace(/,/g, '');
      changes.installment = amount ? Number(amount) : '';
    }
    // Tenure too, only when changed: blank means the loan runs until repaid
    const days = String(this.editForm.durationDays ?? '').trim();
    if (days !== this.editDurationAtOpen) changes.durationDays = days ? Number(days) : '';
    return changes;
  }

  formatEditInstallment(event: any) {
    const digits = String(event.target.value ?? '').replace(/[^0-9]/g, '');
    this.editForm.installment = digits ? Number(digits).toLocaleString('en-IN') : '';
  }

  /** How a changed value reads in the review and the history */
  changeText(field: string, value: string): string {
    if (field === 'client' || field === 'installment' || field === 'durationDays' || field === 'customInstallments') return value || 'none';
    return value ? formatDate(value, 'd MMM y', 'en-IN') : 'not set';
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
