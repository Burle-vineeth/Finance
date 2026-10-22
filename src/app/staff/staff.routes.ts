import { Routes } from '@angular/router';
import { StaffTabsPage } from './staff-tabs.page';

// The staff member's part of the app: record collections and follow their approval
export const routes: Routes = [
  {
    path: '',
    component: StaffTabsPage,
    children: [
      {
        path: 'collect',
        loadComponent: () => import('./collect/collect.page').then((m) => m.CollectPage),
      },
      {
        path: 'entries',
        loadComponent: () => import('./entries/entries.page').then((m) => m.EntriesPage),
      },
      {
        path: '',
        redirectTo: '/staff/collect',
        pathMatch: 'full',
      },
    ],
  },
];
