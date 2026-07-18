import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, 
  IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput, IonSelect, 
  IonSelectOption, IonButton, IonIcon, IonToast, IonList, IonSegment, IonSegmentButton, IonItemSliding, IonItemOptions, IonItemOption
} from '@ionic/angular/standalone';
import { AlertController } from '@ionic/angular';
import { ApiService } from '../services/api.service';

import { arrowUpCircle, arrowDownCircle, trashOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, 
    IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput, IonSelect, 
    IonSelectOption, IonButton, IonIcon, IonToast, IonList, IonSegment, IonSegmentButton, IonItemSliding, IonItemOptions, IonItemOption
  ]
})
export class Tab3Page implements OnInit {
  private apiService = inject(ApiService);
  private fb = inject(FormBuilder);
  private alertController = inject(AlertController);

  public userRole = this.apiService.userRole;

  activeLoans: any[] = [];
  transactions: any[] = [];
  
  repaymentForm: FormGroup;
  viewMode: 'collect' | 'ledger' = 'collect';
  
  showToast = false;
  toastMessage = '';
  toastColor = 'success';

  constructor() {
    addIcons({ 'arrow-up-circle': arrowUpCircle, 'arrow-down-circle': arrowDownCircle, 'trash-outline': trashOutline });
    this.repaymentForm = this.fb.group({
      loan: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(1)]],
      date: [new Date().toISOString().substring(0, 10), Validators.required]
    });
  }

  ngOnInit() {
    this.loadData();
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
    if (this.repaymentForm.invalid) return;

    const rawAmount = String(this.repaymentForm.value.amount).replace(/,/g, '');

    const payload = {
      type: 'REPAYMENT',
      loan: this.repaymentForm.value.loan,
      amount: Number(rawAmount),
      date: this.repaymentForm.value.date,
      notes: 'Logged via App'
    };

    this.apiService.addTransaction(payload).subscribe({
      next: (res) => {
        this.displayToast('Repayment logged successfully! Dashboard updated.');
        this.repaymentForm.reset({
          date: new Date().toISOString().substring(0, 10)
        });
        this.loadData(); // Refresh both lists
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
    const alert = await this.alertController.create({
      header: 'Undo Transaction?',
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
    this.apiService.deleteTransaction(id).subscribe({
      next: () => {
        this.displayToast('Transaction successfully undone.');
        this.loadData();
      },
      error: (err) => {
        this.displayToast('Error undoing transaction', 'danger');
      }
    });
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
