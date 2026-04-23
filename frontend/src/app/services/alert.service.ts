import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { AuthService } from './auth.service';

export interface Alert {
  id: string;
  userId: string;
  coinId: string;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  isTriggered: boolean;
  triggeredAt: string | null;
  isRead: boolean;
  createdAt: string;
  type?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private apiUrl = 'http://localhost:3000/api/alerts';
  
  private activeAlertsSubject = new BehaviorSubject<Alert[]>([]);
  public activeAlerts$ = this.activeAlertsSubject.asObservable();

  private notificationsSubject = new BehaviorSubject<Alert[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private ws: WebSocket | null = null;
  private authSub: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.authSub = this.authService.isAuthenticated$.subscribe(isAuth => {
        if (isAuth) {
          this.loadAlerts();
        } else {
          this.clearAlerts();
        }
      });
    }
  }

  private clearAlerts() {
    this.activeAlertsSubject.next([]);
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
    this.closeWebSocket();
  }

  loadAlerts() {
    this.http.get<{ success: boolean, alerts: Alert[] }>(this.apiUrl).subscribe({
      next: (res) => {
        const allAlerts = res.alerts;
        const active = allAlerts.filter(a => !a.isTriggered);
        const triggered = allAlerts.filter(a => a.isTriggered);
        const unreadCount = triggered.filter(a => !a.isRead).length;

        this.activeAlertsSubject.next(active);
        this.notificationsSubject.next(triggered);
        this.unreadCountSubject.next(unreadCount);

        this.reconnectWebSocket();
      },
      error: (err) => console.error('Failed to load alerts', err)
    });
  }

  createAlert(data: { coinId: string, symbol: string, targetPrice: number, condition: 'above' | 'below' }): Observable<{ success: boolean, alert: Alert }> {
    const ob = this.http.post<{ success: boolean, alert: Alert }>(this.apiUrl, data);
    ob.subscribe(res => {
      if (res.success) {
        const active = [...this.activeAlertsSubject.value, res.alert];
        this.activeAlertsSubject.next(active);
        this.reconnectWebSocket();
      }
    });
    return ob;
  }

  deleteAlert(id: string) {
    this.http.delete(`${this.apiUrl}/${id}`).subscribe(() => {
      const active = this.activeAlertsSubject.value.filter(a => a.id !== id);
      this.activeAlertsSubject.next(active);
      
      const triggered = this.notificationsSubject.value.filter(a => a.id !== id);
      this.notificationsSubject.next(triggered);
      
      this.reconnectWebSocket();
    });
  }

  markAllAsRead() {
    this.http.post(`${this.apiUrl}/mark-all-read`, {}).subscribe(() => {
      this.unreadCountSubject.next(0);
      const triggered = this.notificationsSubject.value.map(a => ({ ...a, isRead: true }));
      this.notificationsSubject.next(triggered);
    });
  }

  private reconnectWebSocket() {
    this.closeWebSocket();
    
    const active = this.activeAlertsSubject.value;
    if (active.length === 0) return;

    // Get unique symbols for Binance (e.g., BTCUSDT)
    const streams = Array.from(new Set(active.map(a => {
      // Handle the format. If symbol is 'btc', Binance needs 'btcusdt'
      // Our target format is lowercase for the WS stream.
      let s = a.symbol.toLowerCase();
      if (!s.endsWith('usdt')) s += 'usdt';
      return `${s}@miniTicker`;
    }))).join('/');

    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.data && data.data.c) {
          const currentPrice = parseFloat(data.data.c);
          // Binance symbol is e.g. BTCUSDT. Our alert symbol could be BTC.
          const streamSymbol = data.data.s.toLowerCase(); // 'btcusdt'
          
          this.checkAlerts(streamSymbol, currentPrice);
        }
      } catch (e) {
        console.error('WS parsing error:', e);
      }
    };
  }

  private checkAlerts(streamSymbol: string, currentPrice: number) {
    const active = this.activeAlertsSubject.value;
    let hasTriggered = false;
    
    for (const alert of active) {
      // Check symbol match
      let s = alert.symbol.toLowerCase();
      if (!s.endsWith('usdt')) s += 'usdt';
      
      if (s !== streamSymbol) continue;

      let triggered = false;
      if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
        triggered = true;
      } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
        triggered = true;
      }

      if (triggered) {
        hasTriggered = true;
        this.triggerAlert(alert, currentPrice);
      }
    }
  }

  private triggerAlert(alert: Alert, currentPrice: number) {
    // Optimistic UI update
    const active = this.activeAlertsSubject.value.filter(a => a.id !== alert.id);
    this.activeAlertsSubject.next(active);

    const triggeredAlert = { 
      ...alert, 
      isTriggered: true, 
      triggeredAt: new Date().toISOString(), 
      isRead: false 
    };
    
    // Add to notifications
    const triggered = [triggeredAlert, ...this.notificationsSubject.value];
    this.notificationsSubject.next(triggered);
    
    // Increment badge
    this.unreadCountSubject.next(this.unreadCountSubject.value + 1);

    // Call backend
    this.http.patch(`${this.apiUrl}/${alert.id}`, { isTriggered: true }).subscribe({
      next: () => {
        // Play notification sound
        this.playNotificationSound();
        this.reconnectWebSocket(); // Reconnect without the triggered alert
      },
      error: (err) => {
        console.error('Failed to trigger alert on backend', err);
        this.loadAlerts(); // Revert on failure
      }
    });
  }

  private playNotificationSound() {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.warn('Browser blocked audio playback', e));
    } catch (e) {
      // Ignore
    }
  }

  private closeWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
