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

  verifyPin(pin: string): Observable<boolean> {
    return this.http.post<{ success: boolean; token: string }>(`${this.baseUrl}/verify-pin`, { pin }).pipe(
      tap(res => {
        if (res && res.token) {
          localStorage.setItem(this.tokenKey, res.token);
          this.isAuthenticatedSubject.next(true);
        }
      }),
      map(res => res.success),
      catchError(() => {
        return of(false);
      })
    );
  }

  changePin(oldPin: string, newPin: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/change-pin`, { oldPin, newPin });
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.isAuthenticatedSubject.next(false);
  }
}
