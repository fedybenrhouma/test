import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './verify-email.html',
  styleUrls: ['./verify-email.scss']
})
export class VerifyEmailComponent implements OnInit {
  status: 'loading' | 'success' | 'error' = 'loading';
  message: string = 'Verifying your email...';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.status = 'error';
      this.message = 'Invalid verification link. Token is missing.';
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: (res) => {
        this.status = 'success';
        this.message = res.message || 'Email verified successfully!';
        
        // Optionally update the current user if they are logged in
        const user = this.authService.getCurrentUser();
        if (user) {
          user.isEmailVerified = true;
          this.authService.updateUser(user);
        }

        setTimeout(() => {
          this.router.navigate(['/markets']);
        }, 3000);
      },
      error: (err) => {
        this.status = 'error';
        this.message = err.error?.message || 'Verification failed. The link might be expired or invalid.';
      }
    });
  }
}
