import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cash, cashOutline, time, timeOutline } from 'ionicons/icons';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-staff-tabs',
  template: `
    <ion-tabs (ionTabsDidChange)="onTabChange($event.tab)">
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="collect" href="/staff/collect">
          <ion-icon aria-hidden="true" [name]="icon('collect', 'cash')"></ion-icon>
          <ion-label>Collect</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="entries" href="/staff/entries">
          <ion-icon aria-hidden="true" [name]="icon('entries', 'time')"></ion-icon>
          <ion-label>My entries</ion-label>
          @if (pendingCount > 0) {
            <ion-badge color="warning">{{ pendingCount }}</ion-badge>
          }
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge],
})
export class StaffTabsPage implements OnInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  // This staff member's entries still waiting for approval
  pendingCount = 0;
  selectedTab = '';

  constructor() {
    addIcons({ cash, 'cash-outline': cashOutline, time, 'time-outline': timeOutline });
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
  }

  loadPendingCount() {
    this.apiService.getCollections('PENDING').subscribe({
      next: (res) => this.pendingCount = res.data.length,
      error: () => {}
    });
  }
}
