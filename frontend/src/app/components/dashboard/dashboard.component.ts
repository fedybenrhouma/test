import { Component, OnInit, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { AuthService, User } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalysisModalComponent } from '../analysis-modal/analysis-modal';

export interface DebateMessage {
  agent_name: string;
  signal: string;
  confidence: number;
  content: string;
  created_at: string;
}

export interface RecentCycle {
  asset: string;
  timeframe: string;
  status: string;
  recommendation: string;
  created_at: string;
  messages: DebateMessage[];
}

export interface Trade {
  asset: string;
  direction: string;
  entry_price: number;
  leverage: number;
  status: string;
}

export interface DashboardData {
  stats: {
    pnlToday: number;
    winRate: number;
    openPositionsCount: number;
    activeDebatesCount: number;
  };
  openTrades: Trade[];
  recentCycles: RecentCycle[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, AnalysisModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DashboardComponent implements OnInit {
  currentUser: User | null = null;
  dashboardData: DashboardData | null = null;
  isLoading = true;

  // Analysis Modal State
  showAnalysisModal = false;
  selectedAssetForAnalysis: string = 'BTC/USDT';

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.fetchDashboardData();
      }
      this.cdr.markForCheck();
    });
  }

  fetchDashboardData(): void {
    this.isLoading = true;
    this.userService.getDashboardSummary().subscribe({
      next: (response) => {
        this.dashboardData = response.data;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching dashboard data:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getSignalClass(signal: string): string {
    if (!signal) return 'chip-neut';
    const s = signal.toLowerCase();
    if (s === 'long' || s === 'bull' || s === 'bullish') return 'chip-bull';
    if (s === 'short' || s === 'bear' || s === 'bearish') return 'chip-bear';
    return 'chip-neut';
  }

  getAgentDotColor(agentName: string): string {
    const name = agentName.toLowerCase();
    if (name.includes('technical')) return '#ef233c';
    if (name.includes('sentiment')) return '#3b82f6';
    if (name.includes('devils') || name.includes('devil')) return '#8b5cf6';
    if (name.includes('risk')) return '#f59e0b';
    if (name.includes('trend')) return '#10b981';
    if (name.includes('signal')) return '#ec4899';
    return '#6b7280';
  }

  openAnalysisModal(): void {
    console.log('Opening Analysis Modal...');
    this.showAnalysisModal = true;
    this.cdr.markForCheck();
  }

  setExecutionMode(mode: 'manual' | 'automatic'): void {
    if (!this.currentUser) return;
    this.userService.updateExecutionMode(mode).subscribe({
      next: (res) => {
        if (this.currentUser) {
          this.currentUser.executionMode = mode;
        }
        this.cdr.markForCheck();
      }
    });
  }

  onAnalysisStarted(): void {
    // Poll for updates every 5 seconds for a minute
    let count = 0;
    const interval = setInterval(() => {
      this.fetchDashboardData();
      count++;
      if (count > 12) clearInterval(interval);
    }, 5000);
  }
}
