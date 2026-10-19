import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap, finalize, share } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api`;

  public userRole = signal<'ADMIN' | 'AUDITOR'>('ADMIN');
  public refresh$ = new Subject<void>();

  // GET requests still waiting for a response, by URL. Pages asking for the same data at the
  // same moment (ngOnInit + ionViewWillEnter, or several tabs reacting to refresh$) share one
  // request. Nothing is kept once the response arrives, so every later call fetches fresh data.
  private pendingGets = new Map<string, Observable<any>>();

  toggleRole() {
    this.userRole.set(this.userRole() === 'ADMIN' ? 'AUDITOR' : 'ADMIN');
  }

  private sharedGet(url: string): Observable<any> {
    const pending = this.pendingGets.get(url);
    if (pending) return pending;

    const request: Observable<any> = this.http.get(url).pipe(
      tap({ next: () => this.forgetPendingGet(url, request) }),
      finalize(() => this.forgetPendingGet(url, request)),
      share()
    );
    this.pendingGets.set(url, request);
    return request;
  }

  private forgetPendingGet(url: string, request: Observable<any>) {
    if (this.pendingGets.get(url) === request) this.pendingGets.delete(url);
  }

  private notifyDataChanged() {
    // Reads that started before this write must not be reused for the refresh that follows it
    this.pendingGets.clear();
    this.refresh$.next();
  }

  // --- Dashboard ---
  getDashboardMetrics(): Observable<any> {
    return this.sharedGet(`${this.baseUrl}/dashboard`);
  }

  // --- Clients ---
  getClients(): Observable<any> {
    return this.sharedGet(`${this.baseUrl}/clients`);
  }

  addClient(clientData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/clients`, clientData).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  // --- Loans ---
  getLoans(): Observable<any> {
    return this.sharedGet(`${this.baseUrl}/loans`);
  }

  addLoan(loanData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/loans`, loanData).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  // --- Transactions ---
  getTransactions(): Observable<any> {
    return this.sharedGet(`${this.baseUrl}/transactions`);
  }

  addTransaction(transactionData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/transactions`, transactionData).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  deleteTransaction(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/transactions/${id}`).pipe(
      tap(() => this.notifyDataChanged())
    );
  }
}
