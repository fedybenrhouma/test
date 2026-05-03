import { Component, EventEmitter, Output, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-modal.component.html',
  styleUrls: ['./login-modal.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LoginModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() loginSuccess = new EventEmitter<void>();

  loginForm!: FormGroup;
  isLoading = false;
  error: string | null = null;
  showPassword = false;
  isSignUp = false;
  isForgotPassword = false;
  forgotPasswordSent = false;
  forgotPasswordForm!: FormGroup;
  signUpForm!: FormGroup;
  signUpSubmitted = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForms();
  }

  initializeForms(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.signUpForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      username: [
        '',
        [Validators.required, Validators.minLength(3), Validators.maxLength(30)],
      ],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    });

    this.forgotPasswordForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  get lf() {
    return this.loginForm.controls;
  }

  get sf() {
    return this.signUpForm.controls;
  }

  get ff() {
    return this.forgotPasswordForm.controls;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleMode(): void {
    this.isSignUp = !this.isSignUp;
    this.isForgotPassword = false;
    this.error = null;
    this.cdr.markForCheck();
  }

  toggleForgotPassword(show: boolean): void {
    this.isForgotPassword = show;
    this.isSignUp = false;
    this.error = null;
    this.forgotPasswordSent = false;
    this.cdr.markForCheck();
  }

  onLogin(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: () => {
        console.log('Login successful');
        this.isLoading = false;
        this.cdr.markForCheck();
        this.loginSuccess.emit();
      },
      error: (error) => {
        console.error('Login error:', error);
        this.isLoading = false;
        
        if (error.status === 403 && error.error?.isBanned) {
          this.closeModal();
          this.authService.triggerBanModal(error.error.banReason, error.error.banExpires);
          return;
        }

        this.error = error.error?.message || 'Login failed. Try again.';
        this.cdr.markForCheck();
      },
    });
  }

  onForgotPassword(): void {
    if (this.forgotPasswordForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    const { email } = this.forgotPasswordForm.value;

    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.forgotPasswordSent = true;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.isLoading = false;
        this.error = error.error?.message || 'Failed to send reset link. Try again.';
        this.cdr.markForCheck();
      }
    });
  }

  onSignUp(): void {
    this.signUpSubmitted = true;

    if (this.signUpForm.invalid) {
      return;
    }

    const { firstName, lastName, email, username, password, confirmPassword } =
      this.signUpForm.value;

    if (password !== confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.authService
      .register({ firstName, lastName, email, username, password })
      .subscribe({
        next: () => {
          console.log('Registration successful');
          this.isLoading = false;
          this.cdr.markForCheck();
          this.loginSuccess.emit();
        },
        error: (error) => {
          console.error('Registration error:', error);
          this.isLoading = false;
          this.error = error.error?.message || 'Registration failed. Try again.';
          this.cdr.markForCheck();
        },
      });
  }

  closeModal(): void {
    this.close.emit();
  }

  onBackdropClick(): void {
    this.closeModal();
  }

  connectWithBinance(): void {
    // Redirect to the backend Binance authentication endpoint
    window.location.href = 'http://localhost:3000/api/binance/auth';
  }
}
