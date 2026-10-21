import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/auth`;

  // Store token in memory and local storage
  private tokenKey = 'finance_token';
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.checkInitialToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private checkInitialToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  public get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  // message carries the server's reason on failure, e.g. attempts left or how long the lockout lasts
  verifyPin(pin: string): Observable<{ success: boolean; message?: string }> {
    return this.http.post<{ success: boolean; token: string }>(`${this.baseUrl}/verify-pin`, { pin }).pipe(
      tap(res => {
        if (res && res.token) {
          localStorage.setItem(this.tokenKey, res.token);
          this.isAuthenticatedSubject.next(true);
        }
      }),
      map(res => ({ success: res.success })),
      catchError((err) => {
        return of({ success: false, message: err.error?.message });
      })
    );
  }

  changePin(oldPin: string, newPin: string): Observable<{ success: boolean; message: string; token?: string }> {
    return this.http.post<{ success: boolean; message: string; token?: string }>(`${this.baseUrl}/change-pin`, { oldPin, newPin }).pipe(
      // Changing the PIN revokes every existing token, so keep this device signed in with the new one
      tap(res => {
        if (res && res.token) {
          localStorage.setItem(this.tokenKey, res.token);
        }
      })
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.isAuthenticatedSubject.next(false);
  }
}
