import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = localStorage.getItem('finance_token');

  const authReq = token
    ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
    : req;

  return next(authReq).pipe(
    catchError((error) => {
      // An expired or revoked token: go back to the sign-in screen instead of leaving every page failing.
      // Signing in answers 401 for a wrong PIN, which must not count as being signed out.
      const isSignIn = req.url.endsWith('/api/auth/login') || req.url.endsWith('/api/auth/verify-pin');
      if (error instanceof HttpErrorResponse && error.status === 401 && !isSignIn) {
        authService.logout();
        router.navigate(['/verify']);
      }
      return throwError(() => error);
    })
  );
};
