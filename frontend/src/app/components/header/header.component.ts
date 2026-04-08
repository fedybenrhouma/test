import { Component, OnInit, ChangeDetectorRef, ViewChild, TemplateRef, Inject, PLATFORM_ID, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AlertService, Alert } from '../../services/alert.service';
import { CryptoMarketService, CryptoMarket } from '../../services/crypto-market.service';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { ThemeService, Theme } from '../../services/theme.service';

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
  
  // Theme State
  showThemeMenu = false;
  currentTheme: Theme = 'default';
  themes: { name: Theme, label: string, color: string }[] = [
    { name: 'default', label: 'Default', color: '#0a0a0a' },
    { name: 'light', label: 'Light', color: '#ffffff' },
    { name: 'dark', label: 'Dark', color: '#121212' },
    { name: 'mono', label: 'Mono', color: '#000000' },
    { name: 'abyss', label: 'Abyss', color: '#00040a' },
    { name: 'midnight', label: 'Midnight', color: '#0b090a' },
    { name: 'ocean', label: 'Ocean', color: '#001219' },
    { name: 'slate', label: 'Slate', color: '#0f172a' },
    { name: 'charcoal', label: 'Charcoal', color: '#171717' },
    { name: 'onyx', label: 'Onyx', color: '#050505' },
    { name: 'obsidian', label: 'Obsidian', color: '#0b090a' },
    { name: 'forest', label: 'Forest', color: '#061005' },
  ];

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
    private themeService: ThemeService,
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
      this.themeService.currentTheme$.subscribe(theme => {
        this.currentTheme = theme;
        this.cdr.markForCheck();
      });

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

  toggleThemeMenu(): void {
    this.showThemeMenu = !this.showThemeMenu;
    if (this.showThemeMenu) {
      this.showNotificationsMenu = false;
      this.showAccountMenu = false;
    }
    this.cdr.markForCheck();
  }

  closeThemeMenu(): void {
    this.showThemeMenu = false;
    this.cdr.markForCheck();
  }

  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
    this.closeThemeMenu();
  }

  toggleNotificationsMenu(): void {
    this.showNotificationsMenu = !this.showNotificationsMenu;
    if (this.showNotificationsMenu) {
      this.showAccountMenu = false;
      this.showThemeMenu = false;
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
      this.showThemeMenu = false;
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
