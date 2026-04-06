import { Component, OnInit, ChangeDetectorRef, ViewChild, TemplateRef, Inject, PLATFORM_ID, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AlertService, Alert } from '../../services/alert.service';
import { CryptoMarketService, CryptoMarket } from '../../services/crypto-market.service';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterModule, FormsModule, LoginModalComponent, ClickOutsideDirective],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HeaderComponent implements OnInit {
  @ViewChild('loginModal') loginModal!: TemplateRef<any>;

  isAuthenticated = false;
  currentUser: any = null;
  showAccountMenu = false;
  showLoginModal = false;
  
  // Notifications State
  unreadCount = 0;
  showNotificationsMenu = false;
  showManageModal = false;
  notifications: Alert[] = [];
  activeAlerts: Alert[] = [];
  
  // Alert Form State
  searchQuery = '';
  searchResults: CryptoMarket[] = [];
  allCoins: CryptoMarket[] = [];
  selectedCoin: CryptoMarket | null = null;
  targetPrice: number | null = null;
  condition: 'above' | 'below' = 'above';
  isSubmitting = false;

  constructor(
    private authService: AuthService,
    private alertService: AlertService,
    private cryptoService: CryptoMarketService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.authService.isAuthenticated$.subscribe((auth) => {
      this.isAuthenticated = auth;
      if (!auth) {
        this.showNotificationsMenu = false;
        this.showManageModal = false;
      }
      this.cdr.markForCheck();
    });

    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      this.cdr.markForCheck();
    });

    this.authService.triggerLoginModal$.subscribe(() => {
      this.openLoginModal();
    });

    if (isPlatformBrowser(this.platformId)) {
      this.alertService.unreadCount$.subscribe(count => {
        this.unreadCount = count;
        this.cdr.markForCheck();
      });

      this.alertService.notifications$.subscribe(alerts => {
        this.notifications = alerts;
        this.cdr.markForCheck();
      });

      this.alertService.activeAlerts$.subscribe(alerts => {
        this.activeAlerts = alerts;
        this.cdr.markForCheck();
      });

      this.cryptoService.getMarkets().subscribe(res => {
        if (res.success) {
          this.allCoins = res.data;
        }
      });
    }
  }

  toggleNotificationsMenu(): void {
    this.showNotificationsMenu = !this.showNotificationsMenu;
    if (this.showNotificationsMenu) {
      this.showAccountMenu = false;
      if (this.unreadCount > 0) {
        this.alertService.markAllAsRead();
      }
    }
    this.cdr.markForCheck();
  }

  closeNotificationsMenu(): void {
    this.showNotificationsMenu = false;
    this.cdr.markForCheck();
  }

  openManageAlertsModal(): void {
    this.showNotificationsMenu = false;
    this.showManageModal = true;
    this.resetForm();
    this.cdr.markForCheck();
  }

  closeManageModal(): void {
    this.showManageModal = false;
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.searchResults = this.allCoins.filter(c => 
      c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
    ).slice(0, 5);
  }

  selectCoin(coin: CryptoMarket): void {
    this.selectedCoin = coin;
    this.targetPrice = coin.current_price;
    this.searchQuery = '';
    this.searchResults = [];
  }

  createAlert(): void {
    if (!this.selectedCoin || !this.targetPrice) return;
    
    this.isSubmitting = true;
    this.alertService.createAlert({
      coinId: this.selectedCoin.id,
      symbol: this.selectedCoin.symbol,
      targetPrice: this.targetPrice,
      condition: this.condition
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.resetForm();
        this.cdr.markForCheck();
      },
      error: () => {
        this.isSubmitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteAlert(id: string): void {
    this.alertService.deleteAlert(id);
  }

  resetForm(): void {
    this.selectedCoin = null;
    this.targetPrice = null;
    this.searchQuery = '';
    this.searchResults = [];
    this.condition = 'above';
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString();
  }

  goToCoin(coinId: string): void {
    this.showNotificationsMenu = false;
    this.router.navigate(['/coin', coinId]);
  }

  // Existing methods...
  openLoginModal(): void {
    this.showLoginModal = true;
    this.cdr.markForCheck();
  }

  closeLoginModal(): void {
    this.showLoginModal = false;
    this.cdr.markForCheck();
  }

  onLoginSuccess(): void {
    this.closeLoginModal();
    this.router.navigate(['/dashboard']);
  }

  toggleAccountMenu(): void {
    this.showAccountMenu = !this.showAccountMenu;
    if (this.showAccountMenu) {
      this.showNotificationsMenu = false;
    }
    this.cdr.markForCheck();
  }

  closeAccountMenu(): void {
    this.showAccountMenu = false;
    this.cdr.markForCheck();
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
    this.closeAccountMenu();
  }

  goToSettings(): void {
    this.router.navigate(['/profile']);
    this.closeAccountMenu();
  }

  logout(): void {
    this.authService.logout();
    this.closeAccountMenu();
    this.router.navigate(['/markets']);
    this.cdr.markForCheck();
  }
}
