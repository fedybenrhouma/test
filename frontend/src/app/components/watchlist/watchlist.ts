import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, OnDestroy, Inject, PLATFORM_ID, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { CryptoMarketService, CryptoMarket } from '../../services/crypto-market.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './watchlist.html',
  styleUrls: ['./watchlist.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Watchlist implements OnInit, AfterViewInit, OnDestroy {
  // Filtered coins that match the watchlist
  allCoins: CryptoMarket[] = [];
  // Currently displayed coins (sliced from allCoins)
  displayedCoins: CryptoMarket[] = [];
  
  loading = false;
  appending = false;
  error: string | null = null;
  
  currentPage = 0;
  pageSize = 50;

  isAuthenticated = false;
  watchlist: Set<string> = new Set();

  @ViewChild('sentinel') sentinel!: ElementRef;
  private observer: IntersectionObserver | null = null;

  constructor(
    private cryptoService: CryptoMarketService,
    private authService: AuthService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.loading = true;
    
    this.authService.isAuthenticated$.subscribe(auth => {
      this.isAuthenticated = auth;
      if (auth) {
        this.loadWatchlist();
      } else {
        this.watchlist.clear();
        this.displayedCoins = [];
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadWatchlist(): void {
    this.userService.getWatchlist().subscribe({
      next: (res) => {
        if (res.success) {
          this.watchlist = new Set(res.watchlist);
          this.loadMarkets(); // Load market data AFTER watchlist is fetched
        } else {
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('Failed to load watchlist', err);
        this.error = 'Failed to load watchlist data';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleWatchlist(event: Event, coinId: string): void {
    event.stopPropagation();

    if (!this.isAuthenticated) {
      this.authService.triggerLoginModal();
      return;
    }

    if (this.watchlist.has(coinId)) {
      this.watchlist.delete(coinId);
      this.userService.removeFromWatchlist(coinId).subscribe();
      
      // Optimistically remove from view
      this.allCoins = this.allCoins.filter(c => c.id !== coinId);
      this.displayedCoins = this.displayedCoins.filter(c => c.id !== coinId);
    } else {
      this.watchlist.add(coinId);
      this.userService.addToWatchlist(coinId).subscribe();
    }
    this.cdr.markForCheck();
  }

  ngAfterViewInit(): void {
    this.setupObserver();
  }

  private setupObserver(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (!this.sentinel) return;

    if (!('IntersectionObserver' in window)) return;

    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !this.loading && !this.appending && this.canLoadMore()) {
          this.loadMoreCoins();
        }
      },
      { threshold: 0.01, rootMargin: '50px' }
    );
    this.observer.observe(this.sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  loadMarkets(): void {
    this.error = null;
    this.currentPage = 0;
    this.allCoins = [];
    this.displayedCoins = [];

    this.cryptoService.getMarkets().subscribe({
      next: (response) => {
        // Filter immediately based on watchlist
        this.allCoins = response.data.filter((coin: CryptoMarket) => this.watchlist.has(coin.id));
        this.displayedCoins = this.allCoins.slice(0, this.pageSize);
        this.loading = false;
        this.cdr.markForCheck();
        
        setTimeout(() => this.setupObserver(), 0);
      },
      error: (error) => {
        console.error('Error loading markets:', error);
        this.error = 'Failed to load cryptocurrency data';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  loadMoreCoins(): void {
    if (!this.canLoadMore()) return;

    this.appending = true;
    this.cdr.markForCheck();

    setTimeout(() => {
      this.currentPage++;
      const endIndex = (this.currentPage + 1) * this.pageSize;
      this.displayedCoins = this.allCoins.slice(0, endIndex);
      this.appending = false;
      this.cdr.markForCheck();
    }, 300);
  }

  canLoadMore(): boolean {
    const nextBoundary = (this.currentPage + 2) * this.pageSize;
    return nextBoundary <= this.allCoins.length;
  }

  formatPrice(price: number | null): string {
    if (price === null || price === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }

  formatMarketCap(cap: number | null): string {
    if (cap === null || cap === undefined) return 'N/A';
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
    return `$${cap.toFixed(0)}`;
  }

  formatVolume(volume: number | null): string {
    if (volume === null || volume === undefined) return 'N/A';
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
    return `$${volume.toFixed(0)}`;
  }

  formatPercent(percent: number | null): string {
    if (percent === null || percent === undefined) return 'N/A';
    return `${percent.toFixed(2)}%`;
  }

  getPercentClass(percent: number | null): string {
    if (percent === null || percent === undefined) return '';
    return percent >= 0 ? 'text-[#27ae60]' : 'text-[#e74c3c]';
  }

  openDetails(id: string): void {
    window.open(`/coin/${id}`, '_blank');
  }
}
