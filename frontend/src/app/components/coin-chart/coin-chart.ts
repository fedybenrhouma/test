import { Component, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { CryptoMarketService } from '../../services/crypto-market.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService, Theme } from '../../services/theme.service';

declare global {
  interface Window {
    TradingView: any;
  }
}

@Component({
  selector: 'app-coin-chart',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './coin-chart.html',
  styleUrl: './coin-chart.scss',
})
export class CoinChart implements AfterViewInit, OnDestroy {
  @ViewChild('tvWidgetContainer', { static: false }) tvWidgetContainer?: ElementRef;
  coinId: string = '';
  symbol: string = '';
  isAuthenticated: boolean = false;
  currentTheme: Theme = 'default';
  private paramSub?: Subscription;
  private authSub?: Subscription;
  private themeSub?: Subscription;
  private lastTvSymbol?: string;

  chartAvailable: boolean = true;
  loadingChart: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private cryptoService: CryptoMarketService,
    private authService: AuthService,
    private themeService: ThemeService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngAfterViewInit() {
    this.authSub = this.authService.isAuthenticated$.subscribe(auth => {
      this.isAuthenticated = auth;
      this.cdr.detectChanges();
    });

    if (isPlatformBrowser(this.platformId)) {
      this.themeSub = this.themeService.currentTheme$.subscribe(theme => {
        const changed = this.currentTheme !== theme;
        this.currentTheme = theme;
        if (changed && this.lastTvSymbol) {
          this.initTradingViewWidget(this.lastTvSymbol);
        }
      });

      this.paramSub = this.route.params.subscribe(params => {
        if (params['name']) {
          this.coinId = params['name'];
          
          // Check query params for symbol
          this.route.queryParams.subscribe(queryParams => {
            if (queryParams['symbol']) {
              this.symbol = queryParams['symbol'].toUpperCase();
              this.checkSymbolAndLoadChart();
            } else {
              // Fetch coin details to get the symbol
              this.loadingChart = true;
              this.cdr.detectChanges();
              this.cryptoService.getCoinDetails(this.coinId).subscribe({
                next: (res) => {
                  if (res.success && res.data && res.data.symbol) {
                    this.symbol = res.data.symbol.toUpperCase();
                    this.checkSymbolAndLoadChart();
                  } else {
                    this.chartAvailable = false;
                    this.loadingChart = false;
                    this.cdr.detectChanges();
                  }
                },
                error: () => {
                  this.chartAvailable = false;
                  this.loadingChart = false;
                  this.cdr.detectChanges();
                }
              });
            }
          });
        }
      });
    }
  }

  ngOnDestroy() {
    if (this.paramSub) {
      this.paramSub.unsubscribe();
    }
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
    if (this.themeSub) {
      this.themeSub.unsubscribe();
    }
  }

  goBack() {
    this.router.navigate(['/coin', this.coinId]);
  }

  private async checkSymbolAndLoadChart() {
    this.loadingChart = true;
    this.chartAvailable = true;
    this.cdr.detectChanges();

    try {
      const validSymbol = await this.findValidSymbol(this.symbol);
      if (validSymbol) {
         this.loadingChart = false;
         this.lastTvSymbol = validSymbol;
         this.cdr.detectChanges(); // Force Angular to render the ViewChild container
         this.loadTradingViewScript(validSymbol);
      } else {
         this.chartAvailable = false;
         this.loadingChart = false;
         this.cdr.detectChanges();
      }
    } catch (e) {
      this.chartAvailable = false;
      this.loadingChart = false;
      this.cdr.detectChanges();
    }
  }

  private async findValidSymbol(symbol: string): Promise<string | null> {
    const checkBinance = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`);
        if (res.ok) return `BINANCE:${symbol}USDT`;
      } catch (e) {}
      return null;
    };
    
    const checkCoinbase = async () => {
      try {
        const res = await fetch(`https://api.exchange.coinbase.com/products/${symbol}-USD`);
        if (res.ok) return `COINBASE:${symbol}USD`;
      } catch (e) {}
      return null;
    };

    const checkBybit = async () => {
      try {
        const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}USDT`);
        const data = await res.json();
        if (data.retCode === 0 && data.result.list.length > 0) return `BYBIT:${symbol}USDT`;
      } catch (e) {}
      return null;
    };

    const binance = await checkBinance();
    if (binance) return binance;
    
    const coinbase = await checkCoinbase();
    if (coinbase) return coinbase;

    const bybit = await checkBybit();
    if (bybit) return bybit;

    return null;
  }

  private loadTradingViewScript(tvSymbol: string) {
    if (window.TradingView) {
      this.initTradingViewWidget(tvSymbol);
      return;
    }

    const scriptId = 'tradingview-widget-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => this.initTradingViewWidget(tvSymbol);
      document.head.appendChild(script);
    } else {
      script.addEventListener('load', () => this.initTradingViewWidget(tvSymbol));
    }
  }

  private initTradingViewWidget(tvSymbol: string) {
    if (!isPlatformBrowser(this.platformId)) return;

    setTimeout(() => {
      if (!window.TradingView || !this.tvWidgetContainer) {
        this.chartAvailable = false;
        this.loadingChart = false;
        this.cdr.detectChanges();
        return;
      }

      this.tvWidgetContainer.nativeElement.innerHTML = '';
      const containerId = 'tv_chart_container_' + Math.random().toString(36).substring(7);

      const div = document.createElement('div');
      div.id = containerId;
      div.style.width = '100%';
      div.style.height = '100%';
      this.tvWidgetContainer.nativeElement.appendChild(div);

      // Map our theme to TradingView's light/dark
      const isLight = this.currentTheme === 'light';
      const tvTheme = isLight ? 'light' : 'dark';
      
      // Manual mapping of theme surfaces to Hex for TradingView (which prefers Hex)
      const themeColors: Record<string, { surface: string, border: string, text: string, red: string, green: string }> = {
        'default': { surface: '#0a0a0a', border: '#1a1a1a', text: '#888888', red: '#ef233c', green: '#00d68f' },
        'light': { surface: '#ffffff', border: '#f0f0f0', text: '#666666', red: '#ef233c', green: '#00d68f' },
        'dark': { surface: '#121212', border: '#2a2a2a', text: '#a0a0a0', red: '#ef233c', green: '#00d68f' },
        'mono': { surface: '#000000', border: '#333333', text: '#888888', red: '#ffffff', green: '#888888' },
        'abyss': { surface: '#00040a', border: '#001d3d', text: '#a9d6e5', red: '#ff4d6d', green: '#00d68f' },
        'midnight': { surface: '#0b090a', border: '#660708', text: '#b1a7a6', red: '#ba181b', green: '#00d68f' },
        'ocean': { surface: '#001219', border: '#005f73', text: '#94d2bd', red: '#ae2012', green: '#00d68f' },
        'slate': { surface: '#0f172a', border: '#334155', text: '#94a3b8', red: '#ef233c', green: '#00d68f' },
        'charcoal': { surface: '#171717', border: '#404040', text: '#a3a3a3', red: '#ef233c', green: '#00d68f' },
        'onyx': { surface: '#050505', border: '#1a1a1a', text: '#737373', red: '#ef233c', green: '#00d68f' },
        'obsidian': { surface: '#0b090a', border: '#303030', text: '#a3a3a3', red: '#ef233c', green: '#00d68f' },
        'forest': { surface: '#061005', border: '#2d3a2a', text: '#97ab96', red: '#ef233c', green: '#4ade80' },
      };

      const colors = themeColors[this.currentTheme] || themeColors['default'];

      new window.TradingView.widget({
        "autosize": true,
        "symbol": tvSymbol,
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": tvTheme,
        "style": "1",
        "locale": "en",
        "toolbar_bg": colors.surface,
        "enable_publishing": false,
        "backgroundColor": colors.surface,
        "gridColor": colors.border,
        "hide_top_toolbar": false,
        "hide_legend": false,
        "hide_side_toolbar": false,
        "withdateranges": true,
        "save_image": false,
        "container_id": containerId,
        "upColor": colors.green,
        "downColor": colors.red,
        "borderUpColor": colors.green,
        "borderDownColor": colors.red,
        "wickUpColor": colors.green,
        "wickDownColor": colors.red
      });
    }, 100);
  }
}
