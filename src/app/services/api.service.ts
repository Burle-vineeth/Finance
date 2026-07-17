import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:5001/api';

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
