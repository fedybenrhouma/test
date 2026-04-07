import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, tap, catchError } from 'rxjs';

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  isPro?: boolean;
  proExpiry?: string;
  isProActive?: boolean;
  role: 'user' | 'admin';
  isBanned?: boolean;
  banReason?: string;
  banExpires?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private triggerLoginModalSubject = new Subject<void>();
  public triggerLoginModal$ = this.triggerLoginModalSubject.asObservable();

  private banDataSubject = new BehaviorSubject<{reason: string, expires: string | null} | null>(null);
  public banData$ = this.banDataSubject.asObservable();

  private isBannedSubject = new BehaviorSubject<boolean>(false);
  public isBanned$ = this.isBannedSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.restoreUser();
      this.isAuthenticatedSubject.next(this.hasToken());
    }
  }

  triggerLoginModal(): void {
    this.triggerLoginModalSubject.next();
  }

  triggerBanModal(reason: string, expires: string | null): void {
    this.banDataSubject.next({ reason, expires });
    this.isBannedSubject.next(true);
  }

  register(data: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/register`, data)
      .pipe(
        tap((response) => {
          if (response.success && response.token) {
            this.setToken(response.token);
            this.currentUserSubject.next(response.user);
            this.updateUser(response.user);
            this.isAuthenticatedSubject.next(true);
          }
        }),
        catchError((error) => {
          console.error('Registration error:', error);
          throw error;
        })
      );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        tap((response) => {
          if (response.success && response.token) {
            console.log('Login successful!');
            console.log('Token:', response.token);
            this.setToken(response.token);
            this.currentUserSubject.next(response.user);
            this.updateUser(response.user);
            this.isAuthenticatedSubject.next(true);
          }
        }),
        catchError((error) => {
          console.error('Login error:', error);
          throw error;
        })
      );
  }

  logout(): void {
    this.clearToken();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  updateUser(user: User): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('current_user', JSON.stringify(user));
    }
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('auth_token');
      console.log('getToken - Retrieved token:', token ? 'Present' : 'Not found');
      return token;
    }
    console.log('getToken - Not in browser platform');
    return null;
  }

  private setToken(token: string): void {
    if (isPlatformBrowser(this.platformId)) {
      console.log('setToken - Storing token in localStorage');
      localStorage.setItem('auth_token', token);
      const stored = localStorage.getItem('auth_token');
      console.log('setToken - Token verified in localStorage:', stored ? 'SUCCESS' : 'FAILED');
    }
  }

  private clearToken(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
    }
  }

  private hasToken(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return !!localStorage.getItem('auth_token');
    }
    return false;
  }

  refreshUser(): Observable<User> {
    return new Observable((observer) => {
      this.http
        .get<{ success: boolean; user: User }>('http://localhost:3000/api/users/profile')
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.updateUser(response.user);
              observer.next(response.user);
              observer.complete();
            }
          },
          error: (error) => {
            console.error('Error refreshing user:', error);
            observer.error(error);
          },
        });
    });
  }

  private restoreUser(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const userJson = localStorage.getItem('current_user');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        this.currentUserSubject.next(user);
        this.isAuthenticatedSubject.next(true);
      } catch (error) {
        console.error('Error restoring user:', error);
        this.clearToken();
      }
    }
  }
}
