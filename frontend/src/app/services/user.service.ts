import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from './auth.service';

export interface ProfileUpdateData {
  firstName: string;
  lastName: string;
  username: string;
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

  constructor(private http: HttpClient) {}

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
}
