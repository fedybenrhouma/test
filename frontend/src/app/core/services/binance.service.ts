import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BinanceStatus, TestResult, ConnectResult } from '../models/binance.model';

@Injectable({
  providedIn: 'root'
})
export class BinanceService {
  private apiUrl = 'http://localhost:3000/api/binance';

  constructor(private http: HttpClient) {}

  getStatus(): Observable<BinanceStatus> {
    return this.http.get<BinanceStatus>(`${this.apiUrl}/status`);
  }

  testKeys(apiKey: string, apiSecret: string): Observable<TestResult> {
    return this.http.post<TestResult>(`${this.apiUrl}/test`, { apiKey, apiSecret });
  }

  connect(apiKey: string, apiSecret: string): Observable<ConnectResult> {
    return this.http.post<ConnectResult>(`${this.apiUrl}/connect`, { apiKey, apiSecret });
  }

  disconnect(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/disconnect`);
  }

  getPortfolio(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/portfolio`);
  }
}
