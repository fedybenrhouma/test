import { Component, Input, Output, EventEmitter, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-analysis-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analysis-modal.html',
  styleUrls: ['./analysis-modal.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AnalysisModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() asset: string = 'BTC/USDT';
  @Output() close = new EventEmitter<void>();
  @Output() analysisStarted = new EventEmitter<void>();

  selectedTimeframe: string = '1h';
  manualPrice: number | null = null;
  manualMargin: number | null = null;
  isStartingAgents = false;

  constructor(
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      console.log('AnalysisModal isOpen changed to:', this.isOpen);
    }
  }

  onClose(): void {
    console.log('AnalysisModal onClose triggered');
    this.close.emit();
  }

  triggerAgents(): void {
    console.log('AnalysisModal triggerAgents called for:', this.asset);
    if (!this.asset) return;

    this.isStartingAgents = true;
    this.userService.startAgents(
      this.asset,
      this.selectedTimeframe,
      this.manualPrice || undefined,
      this.manualMargin || undefined
    ).subscribe({
      next: (response) => {
        alert('Agents are now debating in the background!');
        this.isStartingAgents = false;
        this.analysisStarted.emit();
        this.onClose();
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
