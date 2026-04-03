import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CryptoMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_24h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
  market_cap: number | null;
  total_volume: number | null;
  market_cap_rank: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class CryptoMarketService {
  private apiUrl = 'http://localhost:3000/api/crypto';

  constructor(private http: HttpClient) {}

  getMarkets(): Observable<{
    success: boolean;
    message: string;
    data: CryptoMarket[];
  }> {
    return this.http.get<{
      success: boolean;
      message: string;
      data: CryptoMarket[];
    }>(`${this.apiUrl}/markets`);
  }

  getCoinDetails(coinId: string): Observable<{
    success: boolean;
    message: string;
    data: any;
  }> {
    return this.http.get<{
      success: boolean;
      message: string;
      data: any;
    }>(`${this.apiUrl}/markets/${coinId}`);
  }
}
