import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { MarketsComponent } from './components/markets/markets.component';
import { PortfolioComponent } from './components/portfolio/portfolio.component';
import { CoinChart } from './components/coin-chart/coin-chart';
import { Watchlist } from './components/watchlist/watchlist';
import { CoinDetails } from './components/coin-details/coin-details';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { AuthGuard } from './guards/auth.guard';

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
    path: 'watchlist',
    component: Watchlist,
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
    path: '**',
    redirectTo: 'markets',
  },
];
