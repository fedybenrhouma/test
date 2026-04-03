import { Component, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

declare global {
  interface Window {
    TradingView: any;
  }
}

@Component({
  selector: 'app-coin-chart',
  standalone: true,
  imports: [],
  templateUrl: './coin-chart.html',
  styleUrl: './coin-chart.scss',
})
export class CoinChart implements AfterViewInit, OnDestroy {
  @ViewChild('tvWidgetContainer', { static: true }) tvWidgetContainer!: ElementRef;
  symbol: string = 'BTC';
  private paramSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.paramSub = this.route.params.subscribe(params => {
        if (params['symbol']) {
          this.symbol = params['symbol'].toUpperCase();
        }
        this.loadTradingViewScript();
      });
    }
  }

  ngOnDestroy() {
    if (this.paramSub) {
      this.paramSub.unsubscribe();
    }
  }

  private loadTradingViewScript() {
    if (window.TradingView) {
      this.initTradingViewWidget();
      return;
    }

    const scriptId = 'tradingview-widget-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => this.initTradingViewWidget();
      document.head.appendChild(script);
    } else {
      // Script is already in DOM but maybe not loaded yet
      script.addEventListener('load', () => this.initTradingViewWidget());
    }
  }

  private initTradingViewWidget() {
    if (!window.TradingView) return;

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

    const tvSymbol = `BINANCE:${this.symbol}USDT`;

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
  }
}
