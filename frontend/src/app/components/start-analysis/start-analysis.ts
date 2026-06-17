import { Component, OnInit, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CryptoMarketService, CryptoMarket } from '../../services/crypto-market.service';
import { UserService } from '../../services/user.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-start-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './start-analysis.html',
  styleUrls: ['./start-analysis.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class StartAnalysisComponent implements OnInit {
  searchQuery: string = '';
  allCoins: CryptoMarket[] = [];
  searchResults: CryptoMarket[] = [];
  selectedCoin: CryptoMarket | null = null;
  
  popularCoins: CryptoMarket[] = [];
  
  selectedTimeframe: string = '1h';
  manualMargin: number = 100;
  manualPrice: number | null = null;
  isStarting = false;

  currentStep: number = 1;

  constructor(
    private cryptoService: CryptoMarketService,
    private userService: UserService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cryptoService.getMarkets().subscribe({
      next: (res) => {
        this.allCoins = res.data;
        // Pick popular ones
        const popularSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP'];
        this.popularCoins = this.allCoins.filter(c => popularSymbols.includes(c.symbol.toUpperCase())).slice(0, 4);
        this.cdr.markForCheck();
      }
    });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.searchResults = this.allCoins.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.symbol.toLowerCase().includes(q)
    ).slice(0, 6);
  }

  selectCoin(coin: CryptoMarket): void {
    this.selectedCoin = coin;
    this.searchQuery = '';
    this.searchResults = [];
    this.currentStep = 2;
    this.cdr.markForCheck();
  }

  resetSelection(): void {
    this.selectedCoin = null;
    this.currentStep = 1;
    this.cdr.markForCheck();
  }

  setStep(step: number): void {
    if (step === 2 && !this.selectedCoin) return;
    this.currentStep = step;
  }

  startAnalysis(): void {
    if (!this.selectedCoin) return;

    const asset = `${this.selectedCoin.symbol.toUpperCase()}/USDT`;
    this.isStarting = true;
    
    this.userService.startAgents(
      asset,
      this.selectedTimeframe,
      this.manualPrice || undefined,
      this.manualMargin || undefined
    ).subscribe({
      next: () => {
        alert('Hive-Mind Analysis Started! Redirecting to Dashboard...');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        console.error('Start analysis error:', err);
        alert('Failed to start analysis.');
        this.isStarting = false;
        this.cdr.markForCheck();
      }
    });
  }
}
