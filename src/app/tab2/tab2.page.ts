import { Component, OnInit, inject, effect, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, 
  IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput, IonSelect, 
  IonSelectOption, IonButton, IonIcon, IonToast, IonSegment, IonSegmentButton, IonList, IonBadge, IonModal, IonButtons, IonAvatar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowUpCircle, arrowDownCircle, documentTextOutline, walletOutline, cashOutline, chevronForward, arrowBack, call } from 'ionicons/icons';
import { ApiService } from '../services/api.service';
import { EmptyStateComponent } from '../components/empty-state/empty-state.component';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, 
    IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput, IonSelect, 
    IonSelectOption, IonButton, IonIcon, IonToast, IonSegment, IonSegmentButton, IonList, IonBadge, IonModal, IonButtons, IonAvatar,
    EmptyStateComponent
  ]
})
export class Tab2Page implements OnInit {
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  public userRole = this.apiService.userRole;

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

  openLoanDetails(loan: any) {
    this.selectedLoan = loan;
    this.isModalOpen = true;
  }

  closeLoanDetails() {
    this.isModalOpen = false;
    this.selectedLoan = null;
  }

  getCollectionPercentage(loan: any): number {
    if (!loan || !loan.expectedReturnAmount) return 0;
    return (loan.totalRepaid || 0) / loan.expectedReturnAmount;
  }

  getLoanTransactions(loanId: string | undefined): any[] {
    if (!loanId) return [];
    return this.loanTransactionsMap[loanId] || [];
  }

  clientForm: FormGroup;
  loanForm: FormGroup;
  capitalForm: FormGroup;
  
  showToast = false;
  toastMessage = '';
  toastColor = 'success';

  constructor() {
    effect(() => {
      if (this.userRole() === 'AUDITOR' && this.viewMode === 'forms') {
        this.viewMode = 'clients';
      }
    });

    addIcons({ 
      'arrow-up-circle': arrowUpCircle, 
      'arrow-down-circle': arrowDownCircle,
      'document-text-outline': documentTextOutline,
      'wallet-outline': walletOutline,
      'cash-outline': cashOutline,
      'chevron-forward': chevronForward,
      'arrow-back': arrowBack,
      'call': call
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
      startDate: [new Date().toISOString().substring(0, 10), Validators.required],
    });

    this.capitalForm = this.fb.group({
      type: ['CAPITAL_INJECTION', Validators.required],
      amount: ['', [Validators.required, Validators.min(1)]],
      notes: [''],
      date: [new Date().toISOString().substring(0, 10), Validators.required]
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
      next: (res) => this.allLoans = res.data,
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
    if (this.capitalForm.invalid) return;
    
    const payload = { ...this.capitalForm.value };
    payload.amount = Number(String(payload.amount).replace(/,/g, ''));

    this.apiService.addTransaction(payload).subscribe({
      next: (res) => {
        this.displayToast('Transaction logged!');
        this.capitalForm.reset({ 
          type: 'CAPITAL_INJECTION',
          date: new Date().toISOString().substring(0, 10)
        });
      },
      error: (err) => {
        this.displayToast('Error logging capital', 'danger');
      }
    });
  }

  onCreateClient() {
    if (this.clientForm.invalid) return;
    
    this.apiService.addClient(this.clientForm.value).subscribe({
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
    if (this.loanForm.invalid) return;

    const payload = { ...this.loanForm.value };
    payload.principalAmount = Number(String(payload.principalAmount).replace(/,/g, ''));
    payload.expectedReturnAmount = Number(String(payload.expectedReturnAmount).replace(/,/g, ''));

    this.apiService.addLoan(payload).subscribe({
      next: (res) => {
        this.displayToast('Loan disbursed successfully!');
        this.loanForm.reset({ 
          paymentFrequency: 'DAILY',
          startDate: new Date().toISOString().substring(0, 10)
        });
      },
      error: (err) => {
        this.displayToast('Error disbursing loan', 'danger');
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

  displayToast(message: string, color: string = 'success') {
    this.toastMessage = message;
    this.toastColor = color;
    this.showToast = true;
  }
}
