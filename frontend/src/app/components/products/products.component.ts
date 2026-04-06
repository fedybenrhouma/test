import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProductsComponent {
  isLoading = false;
  error: string | null = null;

  plans = [
    {
      id: 'pro-1m',
      name: 'Pro Monthly',
      price: 20,
      duration: 'month',
      features: ['Real-time Portfolio', 'Unlimited Alerts', 'Trading Agents', 'Priority Support'],
      save: null
    },
    {
      id: 'pro-3m',
      name: 'Pro Quarterly',
      price: 50,
      duration: '3 months',
      features: ['All Pro Features', 'Save $10', 'Early Access', 'Advanced Analytics'],
      save: 'Save $10',
      popular: true
    },
    {
      id: 'pro-6m',
      name: 'Pro Semi-Annual',
      price: 90,
      duration: '6 months',
      features: ['All Pro Features', 'Save $30', 'Direct Developer Access', 'API Access'],
      save: 'Save $30'
    },
    {
      id: 'pro-1y',
      name: 'Pro Annual',
      price: 150,
      duration: 'year',
      features: ['All Pro Features', 'Save $90', 'Lifetime Discount', 'Whale Tracking'],
      save: 'Save $90'
    }
  ];

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  subscribe(planId: string): void {
    if (!this.authService.isAuthenticated()) {
      this.authService.triggerLoginModal();
      return;
    }

    this.isLoading = true;
    this.error = null;

    this.http.post<any>('http://localhost:3000/api/payments/create-checkout-session', { planId }).subscribe({
      next: (response) => {
        if (response.success && response.url) {
          window.location.href = response.url;
        } else {
          this.isLoading = false;
          this.error = 'Could not initiate checkout. Please try again.';
        }
      },
      error: (err) => {
        console.error('Subscription error:', err);
        this.isLoading = false;
        this.error = err.error?.message || 'Payment service is currently unavailable.';
      }
    });
  }
}
