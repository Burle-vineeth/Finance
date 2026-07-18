import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api`;

  public userRole = signal<'ADMIN' | 'AUDITOR'>('ADMIN');

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
    return this.http.post(`${this.baseUrl}/clients`, clientData);
  }

  // --- Loans ---
  getLoans(): Observable<any> {
    return this.http.get(`${this.baseUrl}/loans`);
  }

  addLoan(loanData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/loans`, loanData);
  }

  // --- Transactions ---
  getTransactions(): Observable<any> {
    return this.http.get(`${this.baseUrl}/transactions`);
  }

  addTransaction(transactionData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/transactions`, transactionData);
  }

  deleteTransaction(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/transactions/${id}`);
  }
}
