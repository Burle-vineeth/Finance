import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'verify',
    loadComponent: () => import('./verify/verify.component').then(m => m.VerifyComponent)
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    // The business score, opened from the dashboard
    path: 'score',
    loadComponent: () => import('./score/score.page').then(m => m.ScorePage),
    canActivate: [roleGuard('ADMIN')]
  },
  {
    path: 'staff',
    loadChildren: () => import('./staff/staff.routes').then((m) => m.routes),
    canActivate: [roleGuard('STAFF')]
  },
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
    canActivate: [roleGuard('ADMIN')]
  }
];
