import { Component, DestroyRef, EnvironmentInjector, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge } from '@ionic/angular/standalone';
import { interval } from 'rxjs';
import { addIcons } from 'ionicons';
import { triangle, ellipse, square, statsChart, cash, wallet, checkmarkDoneCircle } from 'ionicons/icons';
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

  constructor() {
    addIcons({ triangle, ellipse, square, 'stats-chart': statsChart, cash, wallet, 'checkmark-done-circle': checkmarkDoneCircle });
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
