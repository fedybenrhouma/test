import { Component, OnInit, OnDestroy, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-trades',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trades.component.html',
  styleUrls: ['./trades.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class TradesComponent implements OnInit, OnDestroy {
  trades: any[] = [];
  isLoading = true;
  filter: 'all' | 'open' | 'closed' = 'all';
  showUsdAmount = true;

  // Global WS State for all open trades
  globalWs: WebSocket | null = null;
  livePrices: { [symbol: string]: number } = {};

  // Modal State
  showCloseModal = false;
  tradeToClose: any = null;
  livePrice: number | null = null;
  livePnl: number | null = null;
  ws: WebSocket | null = null;

  constructor(
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fetchTrades();
  }

  ngOnDestroy(): void {
    this.cleanupWebSocket();
    this.cleanupGlobalWebSocket();
  }

  fetchTrades(): void {
    this.isLoading = true;
    this.userService.getTrades().subscribe({
      next: (response) => {
        this.trades = response.trades || [];
        this.setupGlobalWebSocket();
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching trades:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  setupGlobalWebSocket(): void {
    this.cleanupGlobalWebSocket();
    
    const openTrades = this.trades.filter(t => t.status === 'open');
    if (openTrades.length === 0) return;

    // Extract unique symbols for Binance stream (e.g. btcusdt)
    const symbols = Array.from(new Set(openTrades.map(t => {
      let s = t.asset.split('/')[0].toLowerCase();
      return `${s}usdt`; // assuming pairs end in usdt
    })));

    if (symbols.length === 0) return;

    const streams = symbols.map(s => `${s}@miniTicker`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    
    this.globalWs = new WebSocket(wsUrl);
    this.globalWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.data && data.data.c) {
          const streamSymbol = data.data.s.toLowerCase(); // e.g. btcusdt
          this.livePrices[streamSymbol] = parseFloat(data.data.c);
          this.cdr.markForCheck();
        }
      } catch (e) {
        console.error('Global WS parsing error:', e);
      }
    };
  }

  cleanupGlobalWebSocket(): void {
    if (this.globalWs) {
      this.globalWs.close();
      this.globalWs = null;
    }
  }

  getLivePrice(trade: any): number | null {
    let symbol = trade.asset.split('/')[0].toLowerCase() + 'usdt';
    return this.livePrices[symbol] !== undefined ? this.livePrices[symbol] : null;
  }

  getLivePnl(trade: any): number | null {
    const currentPrice = this.getLivePrice(trade);
    if (currentPrice === null) return null;

    if (trade.direction === 'long') {
      return (currentPrice - parseFloat(trade.entry_price)) * parseFloat(trade.position_size);
    } else {
      return (parseFloat(trade.entry_price) - currentPrice) * parseFloat(trade.position_size);
    }
  }

  setFilter(f: 'all' | 'open' | 'closed'): void {
    this.filter = f;
    this.cdr.markForCheck();
  }

  toggleAmountDisplay(): void {
    this.showUsdAmount = !this.showUsdAmount;
    this.cdr.markForCheck();
  }

  get filteredTrades(): any[] {
    if (this.filter === 'all') return this.trades;
    return this.trades.filter(t => t.status === this.filter);
  }

  openCloseModal(trade: any): void {
    this.tradeToClose = trade;
    this.showCloseModal = true;
    this.livePrice = null;
    this.livePnl = null;
    this.cdr.markForCheck();

    let symbol = trade.asset.replace('/', '').toLowerCase();
    if (!symbol.endsWith('usdt')) {
        symbol += 'usdt';
    }

    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@miniTicker`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.c) {
          this.livePrice = parseFloat(data.c);
          
          // Calculate live PNL
          if (trade.direction === 'long') {
            this.livePnl = (this.livePrice - parseFloat(trade.entry_price)) * parseFloat(trade.position_size);
          } else {
            this.livePnl = (parseFloat(trade.entry_price) - this.livePrice) * parseFloat(trade.position_size);
          }
          this.cdr.markForCheck();
        }
      } catch (e) {
        console.error('WS parsing error:', e);
      }
    };
  }

  closeCloseModal(): void {
    this.showCloseModal = false;
    this.tradeToClose = null;
    this.cleanupWebSocket();
    this.cdr.markForCheck();
  }

  cleanupWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  confirmCloseTrade(): void {
    if (!this.tradeToClose) return;
    
    this.userService.closeTrade(this.tradeToClose.id).subscribe({
      next: (res) => {
        const pnl = res.trade?.pnl !== undefined ? res.trade.pnl : this.livePnl;
        const formattedPnl = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
        alert(`Trade closed successfully! Final PNL: ${formattedPnl}`);
        this.closeCloseModal();
        this.fetchTrades(); // Refresh the list
      },
      error: (err) => {
        console.error('Error closing trade:', err);
        alert('Failed to close trade. Check console.');
        this.closeCloseModal();
      }
    });
  }
}
