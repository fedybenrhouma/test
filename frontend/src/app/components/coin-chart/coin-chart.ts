import { Component, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

declare global {
  interface Window {
    TradingView: any;
  }
}

@Component({
  selector: 'app-coin-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coin-chart.html',
  styleUrl: './coin-chart.scss',
})
export class CoinChart implements AfterViewInit, OnDestroy {
  @ViewChild('tvWidgetContainer', { static: false }) tvWidgetContainer?: ElementRef;
  symbol: string = 'BTC';
  private paramSub?: Subscription;

  chartAvailable: boolean = true;
  loadingChart: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.paramSub = this.route.params.subscribe(params => {
        if (params['symbol']) {
          this.symbol = params['symbol'].toUpperCase();
        }
        this.checkSymbolAndLoadChart();
      });
    }
  }

  ngOnDestroy() {
    if (this.paramSub) {
      this.paramSub.unsubscribe();
    }
  }

  goBack() {
    this.router.navigate(['/markets']);
  }

  private async checkSymbolAndLoadChart() {
    this.loadingChart = true;
    this.chartAvailable = true;
    this.cdr.detectChanges();

    try {
      const validSymbol = await this.findValidSymbol(this.symbol);
      if (validSymbol) {
         this.loadingChart = false;
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
    // Timeout to ensure DOM is updated and ViewChild is accessible
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
      div.style.flex = '1';
      div.style.display = 'flex';
      div.style.overflow = 'hidden';
      this.tvWidgetContainer.nativeElement.appendChild(div);

      new window.TradingView.widget({
        "autosize": true,
        "symbol": tvSymbol,
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": "light",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "backgroundColor": "rgba(255, 255, 255, 1)",
        "gridColor": "rgba(0, 0, 0, 0.06)",
        "hide_top_toolbar": false,
        "hide_legend": false,
        "save_image": false,
        "container_id": containerId,
        "support_host": "https://www.tradingview.com"
      });
    }, 0);
  }
}
