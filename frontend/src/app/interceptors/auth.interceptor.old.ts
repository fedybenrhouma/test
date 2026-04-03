import {
  Injectable,
  Injector,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private injector: Injector,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    let token: string | null = null;
    if (isPlatformBrowser(this.platformId)) {
      token = localStorage.getItem('auth_token');
      console.log('Interceptor - Token from localStorage:', token ? 'Present' : 'Not found');
    }

    if (token) {
      console.log('Interceptor - Attaching token to request:', req.url);
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log('Interceptor - Request headers:', req.headers.get('Authorization'));
    } else {
      console.log('Interceptor - No token available for request:', req.url);
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        console.log('Interceptor - Error response:', error.status, error.statusText);
        if (error.status === 401) {
          if (isPlatformBrowser(this.platformId)) {
            console.log('Interceptor - 401 error, logging out user');
            const authService = this.injector.get(AuthService);
            authService.logout();
            this.router.navigate(['/login']);
          }
        }

        return throwError(() => error);
      })
    );
  }
}
