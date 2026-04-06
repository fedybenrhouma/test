import { Component, OnInit, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BinanceService } from '../../core/services/binance.service';
import { BinanceStatus } from '../../core/models/binance.model';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class PortfolioComponent implements OnInit {
  portfolioData: any = null;
  binanceStatus: BinanceStatus | null = null;
  isLoading = true;
  isStatusLoading = true;
  error: string | null = null;

  constructor(
    private binanceService: BinanceService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.checkStatusAndLoadPortfolio();
  }

  checkStatusAndLoadPortfolio(): void {
    this.isStatusLoading = true;
    this.binanceService.getStatus().subscribe({
      next: (status) => {
        this.binanceStatus = status;
        this.isStatusLoading = false;
        
        if (status.connected) {
          this.loadPortfolio();
        } else {
          this.isLoading = false;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error checking Binance status:', err);
        this.isStatusLoading = false;
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadPortfolio(): void {
    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.binanceService.getPortfolio().subscribe({
      next: (response) => {
        this.portfolioData = response.data;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading portfolio:', err);
        this.error = err.error?.message || 'Failed to load Binance portfolio. Make sure your API keys are correct.';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }
}
