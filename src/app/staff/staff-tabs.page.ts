import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cash, timeOutline } from 'ionicons/icons';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-staff-tabs',
  template: `
    <ion-tabs (ionTabsDidChange)="loadPendingCount()">
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="collect" href="/staff/collect">
          <ion-icon aria-hidden="true" name="cash"></ion-icon>
          <ion-label>Collect</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="entries" href="/staff/entries">
          <ion-icon aria-hidden="true" name="time-outline"></ion-icon>
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

  constructor() {
    addIcons({ cash, 'time-outline': timeOutline });
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
