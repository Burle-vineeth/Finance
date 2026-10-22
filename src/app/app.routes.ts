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
