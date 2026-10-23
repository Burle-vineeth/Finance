import { inject } from '@angular/core';
import { Router, CanActivateFn, UrlTree } from '@angular/router';
import { AuthService, Role } from '../services/auth.service';

// Any signed-in user
export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated) {
    return true;
  }

  return router.parseUrl('/verify');
};

// Only the given role; anyone else is sent to their own home screen.
// This only shapes the app: the server refuses other roles' requests on its own.
export const roleGuard = (role: Role): CanActivateFn => (): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated) {
    return router.parseUrl('/verify');
  }
  return authService.role() === role ? true : router.parseUrl(authService.homeUrl());
};
