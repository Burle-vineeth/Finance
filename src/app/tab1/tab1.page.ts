import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, 
  IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonSpinner, 
  IonList, IonItem, IonLabel, IonIcon, IonButtons, IonButton
} from '@ionic/angular/standalone';
import { ApiService } from '../services/api.service';
import { addIcons } from 'ionicons';
import { cashOutline, trendingUpOutline, walletOutline, alertCircleOutline, calendarOutline } from 'ionicons/icons';

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
      'calendar-outline': calendarOutline
    });
  }

  ngOnInit() {
    this.loadDashboard();
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
}
