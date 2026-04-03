import { Component, OnInit, ChangeDetectorRef, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginModalComponent } from '../login-modal/login-modal.component';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterModule, LoginModalComponent, ClickOutsideDirective],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  @ViewChild('loginModal') loginModal!: TemplateRef<any>;

  isAuthenticated = false;
  currentUser: any = null;
  showAccountMenu = false;
  showLoginModal = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.authService.isAuthenticated$.subscribe((auth) => {
      this.isAuthenticated = auth;
      this.cdr.markForCheck();
    });

    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      this.cdr.markForCheck();
    });
  }

  openLoginModal(): void {
    this.showLoginModal = true;
    this.cdr.markForCheck();
  }

  closeLoginModal(): void {
    this.showLoginModal = false;
    this.cdr.markForCheck();
  }

  onLoginSuccess(): void {
    this.closeLoginModal();
    this.router.navigate(['/dashboard']);
  }

  toggleAccountMenu(): void {
    this.showAccountMenu = !this.showAccountMenu;
    this.cdr.markForCheck();
  }

  closeAccountMenu(): void {
    this.showAccountMenu = false;
    this.cdr.markForCheck();
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
    this.closeAccountMenu();
  }

  goToSettings(): void {
    this.router.navigate(['/dashboard']);
    this.closeAccountMenu();
  }

  logout(): void {
    this.authService.logout();
    this.closeAccountMenu();
    this.router.navigate(['/markets']);
    this.cdr.markForCheck();
  }
}
