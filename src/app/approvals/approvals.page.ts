import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon,
  IonSpinner, IonToast, IonModal, IonItem, IonInput, IonDatetime, AlertController
} from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { checkmark, close, createOutline, warningOutline, chatbubbleOutline, checkmarkDoneCircleOutline } from 'ionicons/icons';
import { ApiService } from '../services/api.service';
import { EmptyStateComponent } from '../components/empty-state/empty-state.component';
import { localDay, localToday } from '../utils/dates';

@Component({
  selector: 'app-approvals',
  templateUrl: 'approvals.page.html',
  styleUrls: ['approvals.page.scss'],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon,
    IonSpinner, IonToast, IonModal, IonItem, IonInput, IonDatetime,
    EmptyStateComponent
  ],
})
export class ApprovalsPage implements OnInit {
  private apiService = inject(ApiService);
  private alertController = inject(AlertController);
  private destroyRef = inject(DestroyRef);

  view: 'pending' | 'reviewed' = 'pending';
  pending: any[] = [];
  reviewed: any[] = [];
  isLoading = true;

  // The entry whose request is running, so its buttons can't be tapped twice
  busyId: string | null = null;
  bulk: { done: number; total: number } | null = null;

  // Edit before approving
  editing: any = null;
  editAmount = '';
  editDate = '';

  showToast = false;
  toastMessage = '';
  toastColor = 'success';

  readonly localDay = localDay;
  // Approved dates can't be in the future
  readonly maxDate = localToday();

  constructor() {
    addIcons({
      checkmark, close, 'create-outline': createOutline, 'warning-outline': warningOutline,
      'chatbubble-outline': chatbubbleOutline, 'checkmark-done-circle-outline': checkmarkDoneCircleOutline
    });
  }

  /** Entries without warnings, which "Approve all" may approve without a closer look */
  get cleanEntries(): any[] {
    return this.pending.filter((e) => !e.warnings?.length);
  }

  get pendingTotal(): number {
    return this.pending.reduce((sum, e) => sum + e.amount, 0);
  }

  ngOnInit() {
    this.load();
    this.apiService.refresh$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  ionViewWillEnter() {
    this.load();
  }

  load() {
    this.apiService.getCollections('PENDING').subscribe({
      next: (res) => {
        this.pending = res.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.displayToast('Could not load collections', 'danger');
      }
    });
    this.apiService.getCollections().subscribe({
      next: (res) => this.reviewed = res.data.filter((e: any) => e.status !== 'PENDING').slice(0, 100),
      error: (err) => console.error(err)
    });
  }

  approve(entry: any, changes: { amount?: number; date?: string } = {}) {
    if (this.busyId || this.bulk) return;
    this.busyId = entry._id;
    this.apiService.approveCollection(entry._id, changes).pipe(
      finalize(() => this.busyId = null)
    ).subscribe({
      next: () => this.displayToast(`Approved: ${entry.client?.name}`),
      error: (err) => this.displayToast(this.errorText(err, 'Could not approve'), 'danger')
    });
  }

  async confirmApproveAll() {
    const entries = this.cleanEntries;
    if (!entries.length || this.bulk) return;
    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    const skipped = this.pending.length - entries.length;
    const alert = await this.alertController.create({
      header: `Approve ${entries.length} ${entries.length === 1 ? 'collection' : 'collections'}?`,
      message: `₹${total.toLocaleString('en-IN')} will be recorded in the ledger.`
        + (skipped ? ` ${skipped} with warnings stay for you to check one by one.` : ''),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Approve all', handler: () => { this.approveAll(entries); } }
      ]
    });
    await alert.present();
  }

  private async approveAll(entries: any[]) {
    this.bulk = { done: 0, total: entries.length };
    let failed = 0;
    // One at a time: each approval updates its loan, and the server keeps them consistent
    for (const entry of entries) {
      try {
        await firstValueFrom(this.apiService.approveCollection(entry._id));
      } catch {
        failed++;
      }
      this.bulk = { done: this.bulk.done + 1, total: entries.length };
    }
    this.bulk = null;
    const approved = entries.length - failed;
    this.displayToast(
      failed ? `Approved ${approved}, ${failed} could not be approved` : `Approved ${approved} ${approved === 1 ? 'collection' : 'collections'}`,
      failed ? 'warning' : 'success'
    );
  }

  openEdit(entry: any) {
    this.editing = entry;
    this.editAmount = String(entry.amount);
    this.editDate = localDay(entry.date);
  }

  closeEdit() {
    this.editing = null;
  }

  get editAmountValue(): number {
    return Number(String(this.editAmount).replace(/,/g, ''));
  }

  approveEdited() {
    const entry = this.editing;
    const amount = this.editAmountValue;
    if (!entry || !(amount > 0) || !this.editDate) return;
    const changes: { amount?: number; date?: string } = {};
    if (amount !== entry.amount) changes.amount = amount;
    if (this.editDate !== localDay(entry.date)) changes.date = this.editDate;
    this.closeEdit();
    this.approve(entry, changes);
  }

  onEditDate(value: any) {
    if (typeof value === 'string') this.editDate = value.substring(0, 10);
  }

  async confirmReject(entry: any) {
    if (this.busyId || this.bulk) return;
    const alert = await this.alertController.create({
      header: 'Reject this collection?',
      message: `${entry.client?.name} · ₹${entry.amount.toLocaleString('en-IN')}. ${entry.submittedBy?.name || 'The staff member'} will see your reason.`,
      inputs: [{ name: 'reason', type: 'textarea', placeholder: 'Reason (required)', attributes: { maxlength: 300 } }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reject',
          role: 'destructive',
          // Returning false keeps the alert open until a reason is typed
          handler: (data) => {
            const reason = (data?.reason || '').trim();
            if (!reason) return false;
            this.reject(entry, reason);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private reject(entry: any, reason: string) {
    this.busyId = entry._id;
    this.apiService.rejectCollection(entry._id, reason).pipe(
      finalize(() => this.busyId = null)
    ).subscribe({
      next: () => this.displayToast(`Rejected: ${entry.client?.name}`, 'medium'),
      error: (err) => this.displayToast(this.errorText(err, 'Could not reject'), 'danger')
    });
  }

  trackById(index: number, item: any) {
    return item?._id || index;
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
