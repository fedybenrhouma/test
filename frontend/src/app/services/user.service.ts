import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from './auth.service';

export interface ProfileUpdateData {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = 'http://localhost:3000/api/users';
  private dashboardUrl = 'http://localhost:3000/api/dashboard';
  private agentsUrl = 'http://localhost:3000/api/agents';
  private tradesUrl = 'http://localhost:3000/api/trades';

  constructor(private http: HttpClient) {}

  startAgents(asset: string, timeframe: string = '1h', targetPrice?: number, margin?: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.agentsUrl}/start`, { asset, timeframe, targetPrice, margin });
  }

  getDashboardSummary(): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(`${this.dashboardUrl}/summary`);
  }

  getDebates(): Observable<{ success: boolean; debates: any[] }> {
    return this.http.get<{ success: boolean; debates: any[] }>(`${this.dashboardUrl}/debates`);
  }

  getTrades(): Observable<{ success: boolean; trades: any[] }> {
    return this.http.get<{ success: boolean; trades: any[] }>(`${this.dashboardUrl}/trades`);
  }

  closeTrade(tradeId: number): Observable<{ success: boolean; message: string; trade: any }> {
    return this.http.post<{ success: boolean; message: string; trade: any }>(`${this.dashboardUrl}/trades/${tradeId}/close`, {});
  }

  updateTrade(tradeId: number, data: { stop_loss?: number, take_profit?: number }): Observable<{ success: boolean; message: string; trade: any }> {
    return this.http.patch<{ success: boolean; message: string; trade: any }>(`${this.tradesUrl}/${tradeId}`, data);
  }

  getProfile(): Observable<{ success: boolean; user: User }> {
    return this.http.get<{ success: boolean; user: User }>(
      `${this.apiUrl}/profile`
    );
  }

  updateProfile(
    data: ProfileUpdateData
  ): Observable<{ success: boolean; message: string; user: User }> {
    return this.http.put<{ success: boolean; message: string; user: User }>(
      `${this.apiUrl}/profile`,
      data
    );
  }

  changePassword(
    data: ChangePasswordData
  ): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/change-password`,
      data
    );
  }

  getWatchlist(): Observable<{ success: boolean; watchlist: string[] }> {
    return this.http.get<{ success: boolean; watchlist: string[] }>(`${this.apiUrl}/watchlist`);
  }

  addToWatchlist(coinId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/watchlist`, { coinId });
  }

  removeFromWatchlist(coinId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/watchlist/${coinId}`);
  }

  updateExecutionMode(mode: 'manual' | 'automatic'): Observable<{ success: boolean; message: string; executionMode: string }> {
    return this.http.patch<{ success: boolean; message: string; executionMode: string }>(`${this.apiUrl}/execution-mode`, { mode });
  }
}
