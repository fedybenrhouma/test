import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { CryptoMarketService, CryptoMarket } from '../../services/crypto-market.service';

@Component({
  selector: 'app-markets',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './markets.component.html',
  styleUrls: ['./markets.component.scss'],
})
export class MarketsComponent implements OnInit, AfterViewInit, OnDestroy {
  // All 250 coins from API (loaded once)
  allCoins: CryptoMarket[] = [];
  // Currently displayed coins (sliced from allCoins)
  displayedCoins: CryptoMarket[] = [];
  
  loading = false;
  appending = false;
  error: string | null = null;
  
  currentPage = 0;
  pageSize = 50;

  @ViewChild('sentinel') sentinel!: ElementRef;
  private observer: IntersectionObserver | null = null;

  constructor(
    private cryptoService: CryptoMarketService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.loadMarkets();
  }

  ngAfterViewInit(): void {
    // Initial setup attempt
    this.setupObserver();
  }

  private setupObserver(): void {
    // Only run in browser, not SSR
    if (!isPlatformBrowser(this.platformId)) {
      console.log('Not in browser context, skipping IntersectionObserver setup');
      return;
    }

    if (!this.sentinel) {
      console.log('Sentinel not yet available, will retry');
      return;
    }

    if (!('IntersectionObserver' in window)) {
      console.log('IntersectionObserver not available in this browser');
      return;
    }

    if (this.observer) {
      this.observer.disconnect();
    }

    console.log('Setting up IntersectionObserver for sentinel:', this.sentinel.nativeElement);
    this.observer = new IntersectionObserver(
      ([entry]) => {
        console.log('Intersection observed:', {
          isIntersecting: entry.isIntersecting,
          totalCoins: this.allCoins.length,
          displayedCount: this.displayedCoins.length,
          canLoadMore: this.canLoadMore(),
        });
        if (entry.isIntersecting && !this.loading && !this.appending && this.canLoadMore()) {
          console.log('Triggering loadMoreCoins');
          this.loadMoreCoins();
        }
      },
      { threshold: 0.01, rootMargin: '50px' }
    );
    this.observer.observe(this.sentinel.nativeElement);
    console.log('IntersectionObserver setup complete');
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  loadMarkets(): void {
    this.loading = true;
    this.error = null;
    this.currentPage = 0;
    this.allCoins = [];
    this.displayedCoins = [];
    this.cdr.markForCheck();

    console.log('Loading all 250 coins from API...');
    this.cryptoService.getMarkets().subscribe({
      next: (response) => {
        console.log('All markets loaded:', response.data.length, 'coins');
        this.allCoins = response.data;
        // Display first page (50 coins)
        this.displayedCoins = this.allCoins.slice(0, this.pageSize);
        this.loading = false;
        this.cdr.markForCheck();
        // Set up observer after markets are rendered
        setTimeout(() => this.setupObserver(), 0);
      },
      error: (error) => {
        console.error('Error loading markets:', error);
        this.error = 'Failed to load cryptocurrency markets';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Load next batch of coins from local array
   * NO API call - just slice from allCoins
   */
  loadMoreCoins(): void {
    if (!this.canLoadMore()) {
      console.log('No more coins to load');
      return;
    }

    console.log('Loading more coins from local array - page:', this.currentPage, 'total displayed:', this.displayedCoins.length);
    this.appending = true;
    this.cdr.markForCheck();

    // Simulate network delay for UX consistency
    setTimeout(() => {
      this.currentPage++;
      const endIndex = (this.currentPage + 1) * this.pageSize;
      this.displayedCoins = this.allCoins.slice(0, endIndex);
      
      console.log('More coins appended:', this.displayedCoins.length, 'total');
      this.appending = false;
      this.cdr.markForCheck();
    }, 300);
  }

  /**
   * Check if there are more coins to load
   */
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

  openChart(symbol: string): void {
    window.open(`/chart/${symbol}`, '_blank');
  }
}
