import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { AuthService, User } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  currentUser: User | null = null;
  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  profileLoading = false;
  passwordLoading = false;
  profileSubmitted = false;
  passwordSubmitted = false;

  profileSuccess = false;
  profileError: string | null = null;
  passwordSuccess = false;
  passwordError: string | null = null;

  activeTab = 'profile';

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private formBuilder: FormBuilder,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForms();
    this.loadUserProfile();
  }

  initializeForms(): void {
    this.profileForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      username: [
        '',
        [Validators.required, Validators.minLength(3), Validators.maxLength(30)],
      ],
    });

    this.passwordForm = this.formBuilder.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    });
  }

  loadUserProfile(): void {
    this.currentUser = this.authService.getCurrentUser();

    if (this.currentUser) {
      this.profileForm.patchValue({
        firstName: this.currentUser.firstName,
        lastName: this.currentUser.lastName,
        username: this.currentUser.username,
      });
    }
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

    const { firstName, lastName, username } = this.profileForm.value;

    this.userService.updateProfile({ firstName, lastName, username }).subscribe({
      next: (response) => {
        this.profileLoading = false;
        this.profileSuccess = true;
        this.currentUser = response.user;
        localStorage.setItem('current_user', JSON.stringify(response.user));

        setTimeout(() => {
          this.profileSuccess = false;
        }, 3000);
      },
      error: (error) => {
        this.profileLoading = false;
        this.profileError =
          error.error?.message || 'Failed to update profile. Try again.';
      },
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
          }, 3000);
        },
        error: (error) => {
          this.passwordLoading = false;
          this.passwordError =
            error.error?.message ||
            'Failed to change password. Try again.';
        },
      });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.profileError = null;
    this.passwordError = null;
  }
}
