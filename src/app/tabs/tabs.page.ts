import { Component, DestroyRef, EnvironmentInjector, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge } from '@ionic/angular/standalone';
import { interval } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  statsChart, statsChartOutline, cash, cashOutline, wallet, walletOutline, checkmarkDoneCircle, checkmarkDoneCircleOutline,
} from 'ionicons/icons';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

// Staff submit from their own phones, so the admin's badge checks for new entries every minute
const PENDING_POLL_MS = 60 * 1000;

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge],
})
export class TabsPage implements OnInit {
  public environmentInjector = inject(EnvironmentInjector);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  // Staff collections waiting for approval, shown on the Approvals tab
  pendingCount = 0;
  selectedTab = '';

  constructor() {
    addIcons({
      'stats-chart': statsChart, 'stats-chart-outline': statsChartOutline, cash, 'cash-outline': cashOutline,
      wallet, 'wallet-outline': walletOutline,
      'checkmark-done-circle': checkmarkDoneCircle, 'checkmark-done-circle-outline': checkmarkDoneCircleOutline,
    });
  }

  // The selected tab's icon is filled, the others outlined
  icon(tab: string, name: string): string {
    return tab === this.selectedTab ? name : `${name}-outline`;
  }

  onTabChange(tab: string) {
    this.selectedTab = tab;
    this.loadPendingCount();
  }

  ngOnInit() {
    this.authService.refreshUser();
    this.loadPendingCount();
    this.apiService.refresh$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadPendingCount());
    interval(PENDING_POLL_MS).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (document.visibilityState === 'visible') this.loadPendingCount();
    });
  }

  loadPendingCount() {
    this.apiService.getApprovalSummary().subscribe({
      next: (res) => this.pendingCount = res.data.pendingCount,
      error: () => {}
    });
  }
}
