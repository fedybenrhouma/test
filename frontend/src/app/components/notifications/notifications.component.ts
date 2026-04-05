import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AlertService, Alert } from '../../services/alert.service';
import { CryptoMarketService, CryptoMarket } from '../../services/crypto-market.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.scss'],
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: Alert[] = [];
  activeAlerts: Alert[] = [];
  
  showManageModal = false;
  searchQuery = '';
  searchResults: CryptoMarket[] = [];
  allCoins: CryptoMarket[] = [];
  
  selectedCoin: CryptoMarket | null = null;
  targetPrice: number | null = null;
  condition: 'above' | 'below' = 'above';
  
  isSubmitting = false;
  
  private notifSub?: Subscription;
  private activeSub?: Subscription;

  constructor(
    private alertService: AlertService,
    private cryptoService: CryptoMarketService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.alertService.markAllAsRead();

      this.notifSub = this.alertService.notifications$.subscribe(alerts => {
        this.notifications = alerts;
        this.cdr.markForCheck();
      });

      this.activeSub = this.alertService.activeAlerts$.subscribe(alerts => {
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

  ngOnDestroy() {
    if (this.notifSub) this.notifSub.unsubscribe();
    if (this.activeSub) this.activeSub.unsubscribe();
  }

  openManageModal() {
    this.showManageModal = true;
    this.resetForm();
    this.cdr.markForCheck();
  }

  closeManageModal() {
    this.showManageModal = false;
    this.cdr.markForCheck();
  }

  onSearchChange() {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.searchResults = this.allCoins.filter(c => 
      c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
    ).slice(0, 5);
  }

  selectCoin(coin: CryptoMarket) {
    this.selectedCoin = coin;
    this.targetPrice = coin.current_price;
    this.searchQuery = '';
    this.searchResults = [];
  }

  createAlert() {
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

  deleteAlert(id: string) {
    this.alertService.deleteAlert(id);
  }

  deleteNotification(id: string) {
    this.alertService.deleteAlert(id);
  }

  resetForm() {
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

  goToCoin(coinId: string) {
    this.router.navigate(['/coin', coinId]);
  }
}
