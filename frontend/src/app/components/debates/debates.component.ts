import { Component, OnInit, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-debates',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './debates.component.html',
  styleUrls: ['./debates.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DebatesComponent implements OnInit {
  debates: any[] = [];
  isLoading = true;
  expandedDebateId: string | null = null;

  constructor(
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fetchDebates();
  }

  fetchDebates(): void {
    this.isLoading = true;
    this.userService.getDebates().subscribe({
      next: (response) => {
        this.debates = response.debates;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching debates:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleExpand(debateId: string): void {
    if (this.expandedDebateId === debateId) {
      this.expandedDebateId = null;
    } else {
      this.expandedDebateId = debateId;
    }
    this.cdr.markForCheck();
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

  getSignalClass(signal: string): string {
    if (!signal) return 'chip-neut';
    const s = signal.toLowerCase();
    if (s === 'long' || s === 'bull' || s === 'bullish') return 'chip-bull';
    if (s === 'short' || s === 'bear' || s === 'bearish') return 'chip-bear';
    return 'chip-neut';
  }
}
