import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type Role = 'ADMIN' | 'STAFF';

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: Role;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/auth`;

  // Kept in localStorage so a reload stays signed in
  private tokenKey = 'finance_token';
  private userKey = 'finance_user';
  // The last username used on this phone, so signing in again only needs the PIN
  private lastUsernameKey = 'finance_last_username';

  /** Who is signed in. The server checks the role on every request; this only decides what the app shows. */
  readonly user = signal<AuthUser | null>(this.readStoredUser());
  readonly role = computed(() => this.user()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'ADMIN');

  private readStoredUser(): AuthUser | null {
    try {
      const user = JSON.parse(localStorage.getItem(this.userKey) || 'null');
      return user && user.role ? user : null;
    } catch {
      return null;
    }
  }

  // A token from before user accounts has no stored user; that session has to sign in again
  public get isAuthenticated(): boolean {
    return !!localStorage.getItem(this.tokenKey) && !!this.user();
  }

  public get lastUsername(): string {
    return localStorage.getItem(this.lastUsernameKey) || '';
  }

  /** Where each role lands after signing in */
  homeUrl(role: Role | null = this.role()): string {
    return role === 'STAFF' ? '/staff/collect' : '/tabs/tab1';
  }

  private storeSession(token: string, user: AuthUser) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.user.set(user);
  }

  // message carries the server's reason on failure, e.g. attempts left or how long the lockout lasts
  login(username: string, pin: string): Observable<{ success: boolean; message?: string }> {
    return this.http.post<{ success: boolean; token: string; user: AuthUser }>(`${this.baseUrl}/login`, { username, pin }).pipe(
      tap(res => {
        this.storeSession(res.token, res.user);
        localStorage.setItem(this.lastUsernameKey, res.user.username);
      }),
      map(() => ({ success: true })),
      catchError((err) => of({ success: false, message: err.error?.message }))
    );
  }

  /** Picks up a name or role change made on the server since this phone signed in */
  refreshUser(): void {
    if (!this.isAuthenticated) return;
    this.http.get<{ user: AuthUser }>(`${this.baseUrl}/me`).subscribe({
      next: (res) => {
        localStorage.setItem(this.userKey, JSON.stringify(res.user));
        this.user.set(res.user);
      },
      // A rejected token is handled by the interceptor (back to the sign-in screen)
      error: () => {}
    });
  }

  changePin(oldPin: string, newPin: string): Observable<{ success: boolean; message: string; token?: string; user?: AuthUser }> {
    return this.http.post<{ success: boolean; message: string; token?: string; user?: AuthUser }>(`${this.baseUrl}/change-pin`, { oldPin, newPin }).pipe(
      // Changing the PIN revokes every existing token, so keep this device signed in with the new one
      tap(res => {
        if (res && res.token && res.user) {
          this.storeSession(res.token, res.user);
        }
      })
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.user.set(null);
  }
}
