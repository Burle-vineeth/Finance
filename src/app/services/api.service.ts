import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api`;

  public userRole = signal<'ADMIN' | 'AUDITOR'>('ADMIN');
  public refresh$ = new Subject<void>();

  toggleRole() {
    this.userRole.set(this.userRole() === 'ADMIN' ? 'AUDITOR' : 'ADMIN');
  }

  // --- Dashboard ---
  getDashboardMetrics(): Observable<any> {
    return this.http.get(`${this.baseUrl}/dashboard`);
  }

  // --- Clients ---
  getClients(): Observable<any> {
    return this.http.get(`${this.baseUrl}/clients`);
  }

  addClient(clientData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/clients`, clientData).pipe(
      tap(() => this.refresh$.next())
    );
  }

  // --- Loans ---
  getLoans(): Observable<any> {
    return this.http.get(`${this.baseUrl}/loans`);
  }

  addLoan(loanData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/loans`, loanData).pipe(
      tap(() => this.refresh$.next())
    );
  }

  // --- Transactions ---
  getTransactions(): Observable<any> {
    return this.http.get(`${this.baseUrl}/transactions`);
  }

  addTransaction(transactionData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/transactions`, transactionData).pipe(
      tap(() => this.refresh$.next())
    );
  }

  deleteTransaction(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/transactions/${id}`).pipe(
      tap(() => this.refresh$.next())
    );
  }
}
