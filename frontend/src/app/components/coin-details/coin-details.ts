import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CryptoMarketService } from '../../services/crypto-market.service';

@Component({
  selector: 'app-coin-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coin-details.html',
  styleUrl: './coin-details.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CoinDetails implements OnInit {
  coinId: string = '';
  coin: any = null;
  loading = true;
  error: string | null = null;
  Math = Math;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cryptoService: CryptoMarketService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      if (params['name']) {
        this.coinId = params['name'];
        this.fetchCoinDetails();
      }
    });
  }

  fetchCoinDetails() {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.cryptoService.getCoinDetails(this.coinId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.coin = res.data;
        } else {
          this.error = 'Coin not found';
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching coin details:', err);
        this.error = 'Failed to load coin details';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  goBack() {
    this.router.navigate(['/markets']);
  }

  openChart() {
    if (this.coin && this.coin.symbol) {
      this.router.navigate(['/coin', this.coinId, 'chart'], { 
        queryParams: { symbol: this.coin.symbol.toUpperCase() } 
      });
    } else {
      this.router.navigate(['/coin', this.coinId, 'chart']);
    }
  }
}
