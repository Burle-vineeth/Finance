import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap, finalize, share } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/** What can be corrected on a loan. installment: an amount sets it; '' works it out from the duration again */
export interface LoanEdit {
  client?: string;
  startDate?: string;
  collectionStartDate?: string | null;
  installment?: number | '';
  durationDays?: number | '';
  // A custom installment plan to set or replace, or null to go back to a tenure and installment
  customInstallments?: { date: string; amount: number }[] | null;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api`;

  public refresh$ = new Subject<void>();

  // GET requests still waiting for a response, by URL. Pages asking for the same data at the
  // same moment (ngOnInit + ionViewWillEnter, or several tabs reacting to refresh$) share one
  // request. Nothing is kept once the response arrives, so every later call fetches fresh data.
  private pendingGets = new Map<string, Observable<any>>();

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

  /** The business score for a range (without one, from the first loan to today), compared with another range */
  getBusinessScore(range: { from?: string; to?: string }, compare: { from: string; to: string } | null): Observable<any> {
    const query = new URLSearchParams();
    if (range.from) query.set('from', range.from);
    if (range.to) query.set('to', range.to);
    if (compare) {
      query.set('compareFrom', compare.from);
      query.set('compareTo', compare.to);
    }
    const qs = query.toString();
    return this.sharedGet(`${this.baseUrl}/dashboard/score${qs ? `?${qs}` : ''}`);
  }

  /** Money expected and collected each day from one YYYY-MM-DD to another; without them, from the first loan to today */
  getCollectionTrend(from?: string, to?: string): Observable<any> {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const qs = query.toString();
    return this.sharedGet(`${this.baseUrl}/dashboard/collections${qs ? `?${qs}` : ''}`);
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

  /** What correcting a loan's details would change (client, disbursement date, collection start), without saving */
  previewLoanEdit(id: string, changes: LoanEdit): Observable<any> {
    return this.http.patch(`${this.baseUrl}/loans/${id}`, { ...changes, dryRun: true });
  }

  updateLoan(id: string, changes: LoanEdit): Observable<any> {
    return this.http.patch(`${this.baseUrl}/loans/${id}`, changes).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  /** Charge a late fee: it adds to what the client owes, and reopens a closed loan until it is paid */
  addLateFee(loanId: string, fee: { amount: number; date: string; note?: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/loans/${loanId}/late-fees`, fee).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  /** Remove a late fee charged by mistake, while the loan still owes it */
  removeLateFee(loanId: string, feeId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/loans/${loanId}/late-fees/${feeId}`).pipe(
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

  // --- Collections reported by staff, which wait for the admin's approval ---
  getCollectableLoans(): Observable<any> {
    return this.sharedGet(`${this.baseUrl}/collections/loans`);
  }

  /** status 'PENDING' lists the approval queue oldest first; for the admin it includes warnings */
  getCollections(status?: string): Observable<any> {
    return this.sharedGet(`${this.baseUrl}/collections${status ? `?status=${status}` : ''}`);
  }

  getApprovalSummary(): Observable<any> {
    return this.sharedGet(`${this.baseUrl}/collections/summary`);
  }

  submitCollection(entry: { loan: string; amount: number; date: string; notes?: string; requestId: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/collections`, entry).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  cancelCollection(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/collections/${id}/cancel`, {}).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  /** changes: a corrected amount and/or date to record instead of what was reported */
  approveCollection(id: string, changes: { amount?: number; date?: string } = {}): Observable<any> {
    return this.http.post(`${this.baseUrl}/collections/${id}/approve`, changes).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  rejectCollection(id: string, reason: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/collections/${id}/reject`, { reason }).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  // --- Team (admin only) ---
  getUsers(): Observable<any> {
    return this.sharedGet(`${this.baseUrl}/users`);
  }

  createStaff(staff: { name: string; username: string; pin: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/users`, staff).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  updateStaff(id: string, changes: { name?: string; active?: boolean }): Observable<any> {
    return this.http.patch(`${this.baseUrl}/users/${id}`, changes).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  resetStaffPin(id: string, pin: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/${id}/reset-pin`, { pin }).pipe(
      tap(() => this.notifyDataChanged())
    );
  }
}
