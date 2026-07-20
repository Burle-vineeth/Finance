import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, 
  IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonSpinner, 
  IonList, IonItem, IonLabel, IonIcon, IonButtons, IonButton
} from '@ionic/angular/standalone';
import { ApiService } from '../services/api.service';
import { addIcons } from 'ionicons';
import { cashOutline, trendingUpOutline, walletOutline, alertCircleOutline, calendarOutline, checkmarkCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [
    CommonModule, 
    IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, 
    IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonSpinner,
    IonList, IonItem, IonLabel, IonIcon, IonButtons, IonButton
  ],
})
export class Tab1Page implements OnInit {
  private apiService = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  public userRole = this.apiService.userRole;
  
  metrics: any = null;
  isLoading = true;
  error = '';

  toggleRole() {
    this.apiService.toggleRole();
  }

  constructor() {
    addIcons({
      'cash-outline': cashOutline,
      'trending-up-outline': trendingUpOutline,
      'wallet-outline': walletOutline,
      'alert-circle-outline': alertCircleOutline,
      'calendar-outline': calendarOutline,
      'checkmark-circle-outline': checkmarkCircleOutline
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
    this.isLoading = true;
    this.apiService.getDashboardMetrics().subscribe({
      next: (res) => {
        this.metrics = res.data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Failed to load dashboard data. Is the backend running?';
        this.isLoading = false;
      }
    });
  }

  getDueStatus(loan: any): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextDate = new Date(loan.nextPaymentDate);
    nextDate.setHours(0, 0, 0, 0);

    if (loan.isCollectedToday) {
      if (nextDate.getTime() === tomorrow.getTime()) {
        return 'Collected, Next Due: Tomorrow';
      } else {
        const dateStr = nextDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        return `Collected, Next Due: ${dateStr}`;
      }
    } else {
      if (nextDate.getTime() <= today.getTime()) {
        return 'Pending Today';
      } else if (nextDate.getTime() === tomorrow.getTime()) {
        return 'Next Due: Tomorrow';
      } else {
        const dateStr = nextDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        return `Next Due: ${dateStr}`;
      }
    }
  }

  getDueStatusColor(loan: any): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDate = new Date(loan.nextPaymentDate);
    nextDate.setHours(0, 0, 0, 0);

    if (loan.isCollectedToday) return 'success';
    if (nextDate.getTime() <= today.getTime()) return 'warning';
    return 'tertiary';
  }

  getDueStatusIcon(loan: any): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDate = new Date(loan.nextPaymentDate);
    nextDate.setHours(0, 0, 0, 0);

    if (loan.isCollectedToday) return 'checkmark-circle-outline';
    if (nextDate.getTime() <= today.getTime()) return 'alert-circle-outline';
    return 'calendar-outline';
  }
}
