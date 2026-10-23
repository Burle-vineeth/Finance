import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon, IonSegment, IonSegmentButton,
  IonLabel, IonSpinner, IonToast, IonRefresher, IonRefresherContent, AlertController
} from '@ionic/angular/standalone';
import { finalize } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { settingsOutline, timeOutline, arrowUndoOutline } from 'ionicons/icons';
import { ApiService } from '../../services/api.service';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';

@Component({
  selector: 'app-entries',
  templateUrl: 'entries.page.html',
  styleUrls: ['entries.page.scss'],
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon, IonSegment, IonSegmentButton,
    IonLabel, IonSpinner, IonToast, IonRefresher, IonRefresherContent,
    EmptyStateComponent
  ],
})
export class EntriesPage implements OnInit {
  private apiService = inject(ApiService);
  private alertController = inject(AlertController);
  private destroyRef = inject(DestroyRef);

  entries: any[] = [];
  isLoading = true;
  view: 'pending' | 'approved' | 'other' = 'pending';
  withdrawingId: string | null = null;

  showToast = false;
  toastMessage = '';
  toastColor = 'success';

  constructor() {
    addIcons({ 'settings-outline': settingsOutline, 'time-outline': timeOutline, 'arrow-undo-outline': arrowUndoOutline });
  }

  get pending() { return this.entries.filter((e) => e.status === 'PENDING'); }
  get approved() { return this.entries.filter((e) => e.status === 'APPROVED'); }
  // Rejected, withdrawn, or undone after approval
  get other() { return this.entries.filter((e) => !['PENDING', 'APPROVED'].includes(e.status)); }

  get visible() {
    return this.view === 'pending' ? this.pending : this.view === 'approved' ? this.approved : this.other;
  }

  ngOnInit() {
    this.load();
    this.apiService.refresh$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  ionViewWillEnter() {
    this.load();
  }

  load(done?: () => void) {
    this.apiService.getCollections().pipe(
      finalize(() => done?.())
    ).subscribe({
      next: (res) => {
        this.entries = res.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.displayToast('Could not load your entries', 'danger');
      }
    });
  }

  refresh(event: any) {
    this.load(() => event.target.complete());
  }

  async confirmWithdraw(entry: any) {
    if (this.withdrawingId) return;
    const alert = await this.alertController.create({
      header: 'Withdraw this entry?',
      message: `${entry.client?.name} · ₹${entry.amount.toLocaleString('en-IN')}. The admin will no longer see it for approval.`,
      buttons: [
        { text: 'Keep', role: 'cancel' },
        { text: 'Withdraw', role: 'destructive', handler: () => { this.withdraw(entry); } }
      ]
    });
    await alert.present();
  }

  private withdraw(entry: any) {
    this.withdrawingId = entry._id;
    this.apiService.cancelCollection(entry._id).pipe(
      finalize(() => this.withdrawingId = null)
    ).subscribe({
      next: () => this.displayToast('Entry withdrawn', 'medium'),
      error: (err) => this.displayToast(err.error?.error || 'Could not withdraw', 'danger')
    });
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
