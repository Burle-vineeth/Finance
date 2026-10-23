import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonIcon, IonButtons, IonButton
} from '@ionic/angular/standalone';
import { ApiService } from '../services/api.service';
import { addIcons } from 'ionicons';
import { cashOutline, trendingUpOutline, walletOutline, alertCircleOutline, calendarOutline, checkmarkCircleOutline, checkmarkDoneCircleOutline, settingsOutline, timeOutline, hourglassOutline, chevronForward } from 'ionicons/icons';
import { dueBadge } from '../utils/due-status';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [
    CommonModule, RouterModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonIcon, IonButtons, IonButton
  ],
})
export class Tab1Page implements OnInit {
  private apiService = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  metrics: any = null;
  isLoading = true;
  error = '';
  // Staff collections waiting for the admin's approval
  approvals = { pendingCount: 0, pendingAmount: 0 };

  constructor() {
    addIcons({
      'cash-outline': cashOutline,
      'trending-up-outline': trendingUpOutline,
      'wallet-outline': walletOutline,
      'alert-circle-outline': alertCircleOutline,
      'calendar-outline': calendarOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'checkmark-done-circle-outline': checkmarkDoneCircleOutline,
      'settings-outline': settingsOutline,
      'time-outline': timeOutline,
      'hourglass-outline': hourglassOutline,
      'chevron-forward': chevronForward
    });
  }

  ngOnInit() {
    this.loadDashboard();
    this.apiService.refresh$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.loadDashboard();
    });
  }

  ionViewWillEnter() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.apiService.getApprovalSummary().subscribe({
      next: (res) => this.approvals = res.data,
      error: (err) => console.error(err)
    });
    this.isLoading = true;
    this.apiService.getDashboardMetrics().subscribe({
      next: (res) => {
        // Each loan's label (overdue, due today, paid ahead...) from its installment schedule
        res.data.collections.activeLoans.forEach((loan: any) => loan.badge = dueBadge(loan.schedule));
        this.metrics = res.data;
        this.error = '';
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Failed to load dashboard data. Is the backend running?';
        this.isLoading = false;
      }
    });
  }
}
