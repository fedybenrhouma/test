import { Component, OnInit, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { User } from '../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AdminDashboardComponent implements OnInit {
  users: User[] = [];
  loading = true;
  error: string | null = null;
  searchTerm = '';
  
  // Give Pro Modal state
  showProModal = false;
  selectedUser: User | null = null;
  proDays = 30;
  proPlanName = 'Admin Gift';
  givingPro = false;

  // Ban Modal state
  showBanModal = false;
  banDays = 7;
  banReason = 'Violation of terms';
  banningUser = false;

  // Unban Modal state
  showUnbanModal = false;
  unbanningUser = false;

  // Admin Modal state
  showAdminModal = false;
  adminAction: 'make' | 'remove' | null = null;
  togglingAdmin = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  get filteredUsers(): User[] {
    if (!this.searchTerm) {
      return this.users;
    }
    const term = this.searchTerm.toLowerCase();
    return this.users.filter(user => 
      user.firstName?.toLowerCase().includes(term) ||
      user.lastName?.toLowerCase().includes(term) ||
      user.username?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term)
    );
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.http.get<any>('http://localhost:3000/api/admin/users').subscribe({
      next: (response) => {
        this.users = response.users;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load users';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  openProModal(user: User): void {
    this.selectedUser = user;
    this.showProModal = true;
  }

  closeProModal(): void {
    this.showProModal = false;
    this.selectedUser = null;
    this.proDays = 30;
  }

  confirmGivePro(): void {
    if (!this.selectedUser) return;

    this.givingPro = true;
    this.http.post<any>('http://localhost:3000/api/admin/give-pro', {
      userId: this.selectedUser.id,
      days: this.proDays,
      planName: this.proPlanName
    }).subscribe({
      next: () => {
        this.givingPro = false;
        this.closeProModal();
        this.loadUsers(); // Refresh list
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to give Pro status');
        this.givingPro = false;
      }
    });
  }

  openBanModal(user: User): void {
    this.selectedUser = user;
    this.showBanModal = true;
  }

  closeBanModal(): void {
    this.showBanModal = false;
    this.selectedUser = null;
    this.banDays = 7;
    this.banReason = 'Violation of terms';
  }

  confirmBan(): void {
    if (!this.selectedUser) return;

    this.banningUser = true;
    this.http.post<any>('http://localhost:3000/api/admin/ban', {
      userId: this.selectedUser.id,
      days: this.banDays,
      reason: this.banReason
    }).subscribe({
      next: () => {
        this.banningUser = false;
        this.closeBanModal();
        this.loadUsers();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to ban user');
        this.banningUser = false;
      }
    });
  }

  unbanUser(user: User): void {
    this.selectedUser = user;
    this.showUnbanModal = true;
  }

  closeUnbanModal(): void {
    this.showUnbanModal = false;
    this.selectedUser = null;
  }

  confirmUnban(): void {
    if (!this.selectedUser) return;

    this.unbanningUser = true;
    this.http.post<any>('http://localhost:3000/api/admin/unban', {
      userId: this.selectedUser.id
    }).subscribe({
      next: () => {
        this.unbanningUser = false;
        this.closeUnbanModal();
        this.loadUsers();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to unban user');
        this.unbanningUser = false;
      }
    });
  }

  toggleAdmin(user: User): void {
    const isAdmin = user.role === 'admin';
    this.selectedUser = user;
    this.adminAction = isAdmin ? 'remove' : 'make';
    this.showAdminModal = true;
  }

  closeAdminModal(): void {
    this.showAdminModal = false;
    this.selectedUser = null;
    this.adminAction = null;
  }

  confirmToggleAdmin(): void {
    if (!this.selectedUser || !this.adminAction) return;

    const isAdmin = this.selectedUser.role === 'admin';
    const action = this.adminAction === 'remove' ? 'remove-admin' : 'make-admin';

    this.togglingAdmin = true;
    this.http.post<any>(`http://localhost:3000/api/admin/${action}`, {
      userId: this.selectedUser.id
    }).subscribe({
      next: () => {
        this.togglingAdmin = false;
        this.closeAdminModal();
        this.loadUsers();
      },
      error: (err) => {
        alert(err.error?.message || `Failed to ${isAdmin ? 'remove' : 'make'} admin`);
        this.togglingAdmin = false;
      }
    });
  }

  getProEndDate(): Date {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + this.proDays);
    return endDate;
  }

  getBanEndDate(): Date {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + this.banDays);
    return endDate;
  }
}
