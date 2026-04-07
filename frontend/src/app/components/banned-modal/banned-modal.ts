import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Subscription, timer } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-banned-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './banned-modal.html',
  styleUrls: ['./banned-modal.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class BannedModalComponent implements OnInit, OnDestroy {
  show = false;
  banData: { reason: string; expires: string | null } | null = null;
  countdown = 10;
  private sub: Subscription | null = null;
  private timerSub: Subscription | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.sub = this.authService.isBanned$.subscribe(isBanned => {
      this.show = isBanned;
      if (isBanned) {
        this.authService.banData$.pipe(take(1)).subscribe(data => {
          this.banData = data;
          this.startCountdown();
        });
      }
    });
  }

  startCountdown(): void {
    if (this.timerSub) this.timerSub.unsubscribe();
    this.countdown = 10;
    this.timerSub = timer(1000, 1000).subscribe(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.logout();
      }
    });
  }

  logout(): void {
    if (this.timerSub) this.timerSub.unsubscribe();
    this.authService.logout();
    this.show = false;
    // Reload to clear app state
    window.location.reload();
  }

  ngOnDestroy(): void {
    if (this.sub) this.sub.unsubscribe();
    if (this.timerSub) this.timerSub.unsubscribe();
  }
}
