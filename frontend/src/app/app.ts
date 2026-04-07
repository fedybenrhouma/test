import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { BannedModalComponent } from './components/banned-modal/banned-modal';
import { AuthService } from './services/auth.service';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap, filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HeaderComponent, FooterComponent, BannedModalComponent, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  isAuthenticated = false;
  private refreshSub: Subscription | null = null;

  constructor(
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.authService.isAuthenticated$.subscribe(auth => {
        this.isAuthenticated = auth;
        
        if (auth) {
          this.startPeriodicRefresh();
        } else {
          this.stopPeriodicRefresh();
        }
      });

      // Check if current user is banned
      this.authService.currentUser$.subscribe(user => {
        if (user && user.isBanned) {
          this.authService.triggerBanModal(user.banReason || 'Violation of terms', user.banExpires || null);
        }
      });
    }
  }

  private startPeriodicRefresh() {
    if (this.refreshSub) return;

    // Refresh user profile every 15 seconds to detect real-time bans/changes
    this.refreshSub = interval(15000).pipe(
      startWith(0),
      switchMap(() => this.authService.refreshUser())
    ).subscribe({
      error: (err) => {
        // Interceptor handles 401/403, so we just log other errors
        if (err.status !== 401 && err.status !== 403) {
          console.error('Periodic profile refresh failed:', err);
        }
      }
    });
  }

  private stopPeriodicRefresh() {
    if (this.refreshSub) {
      this.refreshSub.unsubscribe();
      this.refreshSub = null;
    }
  }
}
