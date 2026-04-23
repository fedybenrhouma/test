import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { AuthService, User } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  currentUser: User | null = null;
  dashboardData: DashboardData | null = null;
  isLoading = true;

  // Agent Trigger Modal
  selectedAsset: string = 'BTC/USDT';
  selectedTimeframe: string = '1h';
  isStartingAgents = false;

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

  triggerAgents(): void {
    if (!this.selectedAsset) return;
    
    this.isStartingAgents = true;
    this.userService.startAgents(this.selectedAsset, this.selectedTimeframe).subscribe({
      next: (response) => {
        alert('Agents are now debating in the background! The feed will update shortly.');
        this.isStartingAgents = false;
        // Poll for updates every 5 seconds for a minute
        let count = 0;
        const interval = setInterval(() => {
          this.fetchDashboardData();
          count++;
          if (count > 12) clearInterval(interval);
        }, 5000);
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error starting agents:', err);
        alert('Failed to start agents. Check console for details.');
        this.isStartingAgents = false;
        this.cdr.markForCheck();
      }
    });
  }
}
