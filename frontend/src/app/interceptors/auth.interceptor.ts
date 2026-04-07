import {
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject, PLATFORM_ID, Injector } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, throwError, finalize } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);
  const injector = inject(Injector);

  let token: string | null = null;

  if (isPlatformBrowser(platformId)) {
    token = localStorage.getItem('auth_token');
    console.log('AuthInterceptor - Token from localStorage:', token ? 'Present' : 'Not found');
  }

  if (token) {
    console.log('AuthInterceptor - Attaching token to request:', req.url);
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log(
      'AuthInterceptor - Authorization header set:',
      req.headers.get('Authorization')
    );
  } else {
    console.log(
      'AuthInterceptor - No token available for request:',
      req.url
    );
  }

  return next(req).pipe(
    finalize(() => {
      console.log('AuthInterceptor - Request finalized:', req.url);
    }),
    catchError((error: HttpErrorResponse) => {
      console.log(
        'AuthInterceptor - Error response:',
        error.status,
        error.statusText
      );

      if (error.status === 401) {
        if (isPlatformBrowser(platformId)) {
          console.log('AuthInterceptor - 401 error, logging out user');
          const authService = injector.get(AuthService);
          authService.logout();
          router.navigate(['/login']);
        }
      }

      if (error.status === 403 && error.error?.isBanned) {
        const authService = injector.get(AuthService);
        authService.triggerBanModal(error.error.banReason, error.error.banExpires);
      }

      return throwError(() => error);
    })
  );
};

