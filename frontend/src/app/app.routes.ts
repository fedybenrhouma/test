import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { TradesComponent } from './components/trades/trades.component';
import { DebatesComponent } from './components/debates/debates.component';
import { MarketsComponent } from './components/markets/markets.component';
import { PortfolioComponent } from './components/portfolio/portfolio.component';
import { CoinChart } from './components/coin-chart/coin-chart';
import { Watchlist } from './components/watchlist/watchlist';
import { CoinDetails } from './components/coin-details/coin-details';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { ProfileComponent } from './components/profile/profile.component';
import { ProductsComponent } from './components/products/products.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard';
import { AdminBansComponent } from './components/admin-bans/admin-bans';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'markets',
    pathMatch: 'full',
  },
  {
    path: 'markets',
    component: MarketsComponent,
  },
  {
    path: 'products',
    component: ProductsComponent,
    data: { title: 'Products' }
  },
  {
    path: 'admin',
    component: AdminDashboardComponent,
    canActivate: [AuthGuard, AdminGuard],
  },
  {
    path: 'admin/bans',
    component: AdminBansComponent,
    canActivate: [AuthGuard, AdminGuard],
  },
  {
    path: 'watchlist',
    component: Watchlist,
    canActivate: [AuthGuard],
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'notifications',
    component: NotificationsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'coin/:name',
    component: CoinDetails,
  },
  {
    path: 'coin/:name/chart',
    component: CoinChart,
  },
  {
    path: 'portfolio',
    component: PortfolioComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'dashboard/trades',
    component: TradesComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'dashboard/debates',
    component: DebatesComponent,
    canActivate: [AuthGuard],
  },
  {
    path: '**',
    redirectTo: 'markets',
  },
];
