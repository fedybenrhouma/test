import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
    private router: Router,
    private cdr: ChangeDetectorRef
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
    // First try to get from auth service
    this.currentUser = this.authService.getCurrentUser();
    
    if (this.currentUser) {
      console.log('Loading user from authService:', this.currentUser);
      this.profileForm.patchValue({
        firstName: this.currentUser.firstName,
        lastName: this.currentUser.lastName,
        username: this.currentUser.username,
      });
    }

    // Fetch fresh data from server
    this.userService.getProfile().subscribe({
      next: (response) => {
        console.log('Fresh user data from server:', response.user);
        this.currentUser = response.user;
        this.profileForm.patchValue({
          firstName: response.user.firstName,
          lastName: response.user.lastName,
          username: response.user.username,
        });
      },
      error: (error) => {
        console.error('Error fetching profile:', error);
      }
    });
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
      console.log('Profile form is invalid');
      return;
    }

    this.profileLoading = true;
    this.cdr.markForCheck();

    const { firstName, lastName, username } = this.profileForm.value;

    console.log('Updating profile with:', { firstName, lastName, username });

    this.userService.updateProfile({ firstName, lastName, username }).subscribe({
      next: (response) => {
        console.log('Profile updated successfully:', response);
        this.profileLoading = false;
        this.cdr.markForCheck();
        this.profileSuccess = true;
        this.currentUser = response.user;
        
        // Update auth service with new user data
        localStorage.setItem('current_user', JSON.stringify(response.user));
        console.log('User data saved to localStorage');

        setTimeout(() => {
          this.profileSuccess = false;
          this.cdr.markForCheck();
        }, 3000);
      },
      error: (error) => {
        console.error('Profile update error:', error);
        this.profileLoading = false;
        this.cdr.markForCheck();
        this.profileError =
          error.error?.message || 'Failed to update profile. Try again.';
      },
      complete: () => {
        console.log('Profile update request completed');
        this.profileLoading = false;
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

    console.log('Changing password...');

    this.userService
      .changePassword({ currentPassword, newPassword })
      .subscribe({
        next: (response) => {
          console.log('Password changed successfully:', response);
          this.passwordLoading = false;
          this.cdr.markForCheck();
          this.passwordSuccess = true;
          this.passwordForm.reset();
          this.passwordSubmitted = false;

          setTimeout(() => {
            this.passwordSuccess = false;
            this.cdr.markForCheck();
          }, 3000);
        },
        error: (error) => {
          console.error('Password change error:', error);
          this.passwordLoading = false;
          this.cdr.markForCheck();
          this.passwordError =
            error.error?.message ||
            error.message ||
            'Failed to change password. Try again.';
        },
        complete: () => {
          console.log('Password change request completed');
          this.passwordLoading = false;
          this.cdr.markForCheck();
        }
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
