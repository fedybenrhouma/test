import { Component, OnInit, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { AuthService, User } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { BinanceService } from '../../core/services/binance.service';
import { BinanceStatus, TestResult } from '../../core/models/binance.model';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProfileComponent implements OnInit {
  currentUser: User | null = null;
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  binanceForm!: FormGroup;

  profileLoading = false;
  passwordLoading = false;
  profileSubmitted = false;
  passwordSubmitted = false;

  profileSuccess = false;
  profileError: string | null = null;
  passwordSuccess = false;
  passwordError: string | null = null;

  activeTab = 'profile';

  // Binance properties
  binanceStatus: BinanceStatus | null = null;
  statusLoading = true;
  formLoading = false;
  testLoading = false;
  testResult: TestResult | null = null;
  showForm = false;
  showSecret = false;
  showDisconnectConfirm = false;

  // Subscription properties
  subscriptions: any[] = [];
  isSubLoading = false;
  isCancelling = false;
  showCancelConfirm = false;
  subIdToCancel: string | null = null;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private binanceService: BinanceService,
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeForms();
    this.loadUserProfile();
    this.loadBinanceStatus();

    // Check for tab query param
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.setActiveTab(params['tab']);
      }
    });
  }

  initializeForms(): void {
    this.profileForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      username: [
        '',
        [Validators.required, Validators.minLength(3), Validators.maxLength(30)],
      ],
      email: ['', [Validators.required, Validators.email]],
    });

    this.passwordForm = this.formBuilder.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    });

    this.binanceForm = this.formBuilder.group({
      apiKey: ['', [Validators.required, Validators.minLength(10)]],
      apiSecret: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  loadUserProfile(): void {
    // First try to get from auth service
    this.currentUser = this.authService.getCurrentUser();
    
    if (this.currentUser) {
      this.profileForm.patchValue({
        firstName: this.currentUser.firstName,
        lastName: this.currentUser.lastName,
        username: this.currentUser.username,
        email: this.currentUser.email,
      });
    }

    // Fetch fresh data from server
    this.userService.getProfile().subscribe({
      next: (response) => {
        this.currentUser = response.user;
        // Update auth service with latest user data (includes pro status)
        this.authService.updateUser(response.user);
        this.profileForm.patchValue({
          firstName: response.user.firstName,
          lastName: response.user.lastName,
          username: response.user.username,
          email: response.user.email,
        });
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error fetching profile:', error);
      }
    });
  }

  loadBinanceStatus(): void {
    this.statusLoading = true;
    this.cdr.markForCheck();
    
    this.binanceService.getStatus().subscribe({
      next: (status) => {
        this.binanceStatus = status;
        this.statusLoading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error fetching Binance status:', error);
        this.statusLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  testConnection(): void {
    if (this.binanceForm.invalid) return;
    
    this.testLoading = true;
    this.testResult = null;
    this.cdr.markForCheck();

    const { apiKey, apiSecret } = this.binanceForm.value;
    
    this.binanceService.testKeys(apiKey, apiSecret).subscribe({
      next: (result) => {
        this.testResult = result;
        this.testLoading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.testResult = { valid: false, message: error.error?.message || 'Test failed' };
        this.testLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  saveConnection(): void {
    if (this.binanceForm.invalid) return;

    this.formLoading = true;
    this.cdr.markForCheck();

    const { apiKey, apiSecret } = this.binanceForm.value;

    this.binanceService.connect(apiKey, apiSecret).subscribe({
      next: (result) => {
        this.formLoading = false;
        this.showForm = false;
        this.binanceStatus = {
          connected: true,
          maskedKey: result.maskedKey,
          connectedAt: result.connectedAt,
          futuresEnabled: result.futuresEnabled
        };
        this.binanceForm.reset();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.formLoading = false;
        this.testResult = { valid: false, message: error.error?.error || error.error?.message || 'Failed to connect' };
        this.cdr.markForCheck();
      }
    });
  }

  disconnectBinance(): void {
    this.binanceService.disconnect().subscribe({
      next: () => {
        this.binanceStatus = { connected: false };
        this.showDisconnectConfirm = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error disconnecting Binance:', error);
        this.showDisconnectConfirm = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleSecret(): void {
    this.showSecret = !this.showSecret;
  }

  get pf() {
    return this.profileForm.controls;
  }

  get pwf() {
    return this.passwordForm.controls;
  }

  onUpdateProfile(): void {
    this.profileSubmitted = true;
    this.profileError = null;
    this.profileSuccess = false;

    if (this.profileForm.invalid) {
      return;
    }

    this.profileLoading = true;
    this.cdr.markForCheck();

    const updateData = this.profileForm.value;

    this.userService.updateProfile(updateData).subscribe({
      next: (response) => {
        this.profileLoading = false;
        this.profileSuccess = true;
        this.currentUser = response.user;
        
        // Update auth service state
        this.authService.updateUser(response.user);

        setTimeout(() => {
          this.profileSuccess = false;
          this.cdr.markForCheck();
        }, 3000);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.profileLoading = false;
        this.profileError =
          error.error?.message || 'Failed to update profile. Try again.';
        this.cdr.markForCheck();
      }
    });
  }

  onChangePassword(): void {
    this.passwordSubmitted = true;
    this.passwordError = null;
    this.passwordSuccess = false;

    if (this.passwordForm.invalid) {
      return;
    }

    const { currentPassword, newPassword, confirmPassword } =
      this.passwordForm.value;

    if (newPassword !== confirmPassword) {
      this.passwordError = 'New passwords do not match';
      return;
    }

    this.passwordLoading = true;
    this.cdr.markForCheck();

    this.userService
      .changePassword({ currentPassword, newPassword })
      .subscribe({
        next: (response) => {
          this.passwordLoading = false;
          this.passwordSuccess = true;
          this.passwordForm.reset();
          this.passwordSubmitted = false;

          setTimeout(() => {
            this.passwordSuccess = false;
            this.cdr.markForCheck();
          }, 3000);
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.passwordLoading = false;
          this.passwordError =
            error.error?.message ||
            'Failed to change password. Try again.';
          this.cdr.markForCheck();
        }
      });
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.profileError = null;
    this.passwordError = null;
    
    if (tab === 'plans') {
      this.loadSubscriptions();
    }
  }

  loadSubscriptions(): void {
    this.isSubLoading = true;
    this.cdr.markForCheck();

    this.http.get<any>('http://localhost:3000/api/payments/subscriptions').subscribe({
      next: (response) => {
        this.subscriptions = response.subscriptions;
        this.isSubLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading subscriptions:', err);
        this.isSubLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  cancelSubscription(id: string | null = null): void {
    // Show modal instead of browser confirm
    this.subIdToCancel = id;
    this.showCancelConfirm = true;
  }

  confirmCancelSubscription(): void {
    this.isCancelling = true;
    this.cdr.markForCheck();

    this.http.post<any>('http://localhost:3000/api/payments/cancel-subscription', {
      subscriptionId: this.subIdToCancel
    }).subscribe({
      next: (response) => {
        this.isCancelling = false;
        this.showCancelConfirm = false;
        this.subIdToCancel = null;
        // Refresh profile and subscriptions
        this.loadUserProfile();
        this.loadSubscriptions();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error cancelling subscription:', err);
        this.isCancelling = false;
        this.showCancelConfirm = false;
        this.subIdToCancel = null;
        this.cdr.markForCheck();
      }
    });
  }

  closeCancelConfirm(): void {
    this.showCancelConfirm = false;
  }
}
