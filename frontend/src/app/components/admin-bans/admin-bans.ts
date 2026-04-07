import { Component, OnInit, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { User } from '../../services/auth.service';

@Component({
  selector: 'app-admin-bans',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-bans.html',
  styleUrls: ['./admin-bans.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AdminBansComponent implements OnInit {
  bans: any[] = [];
  loading = true;
  error: string | null = null;
  searchTerm = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadBans();
  }

  get filteredBans(): any[] {
    if (!this.searchTerm) return this.bans;
    const term = this.searchTerm.toLowerCase();
    return this.bans.filter(ban => 
      ban.username?.toLowerCase().includes(term) ||
      ban.email?.toLowerCase().includes(term) ||
      ban.banReason?.toLowerCase().includes(term)
    );
  }

  loadBans(): void {
    this.loading = true;
    this.http.get<any>('http://localhost:3000/api/admin/bans').subscribe({
      next: (response) => {
        this.bans = response.bans;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load bans';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  unbanUser(user: any): void {
    if (!confirm(`Are you sure you want to unban ${user.username}?`)) return;

    this.http.post<any>('http://localhost:3000/api/admin/unban', {
      userId: user.id
    }).subscribe({
      next: () => {
        this.loadBans();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to unban user');
      }
    });
  }
}
