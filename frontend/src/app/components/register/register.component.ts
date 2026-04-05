import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

export class PasswordStrengthValidator {
  static match(controlName: string, matchingControlName: string): ValidatorFn {
    return (abstractControl: AbstractControl): ValidationErrors | null => {
      const control = abstractControl.get(controlName);
      const matchingControl = abstractControl.get(matchingControlName);

      if (matchingControl?.errors && !matchingControl.errors['passwordMismatch']) {
        return null;
      }

      if (control?.value !== matchingControl?.value) {
        matchingControl?.setErrors({ passwordMismatch: true });
        return { passwordMismatch: true };
      } else {
        matchingControl?.setErrors(null);
        return null;
      }
    };
  }
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  loading = false;
  submitted = false;
  error: string | null = null;
  success = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.registerForm = this.formBuilder.group(
      {
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        username: [
          '',
          [Validators.required, Validators.minLength(3), Validators.maxLength(30)],
        ],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      {
        validators: PasswordStrengthValidator.match('password', 'confirmPassword'),
      }
    );
  }

  get f() {
    return this.registerForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = null;

    if (this.registerForm.invalid) {
      return;
    }

    this.loading = true;

    const {
      email,
      username,
      password,
      firstName,
      lastName,
    } = this.registerForm.value;

    this.authService
      .register({ email, username, password, firstName, lastName })
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.success = true;
          localStorage.setItem('current_user', JSON.stringify(response.user));
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1500);
        },
        error: (error) => {
          this.loading = false;
          this.error =
            error.error?.message || 'Registration failed. Please try again.';
        },
      });
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }
}
