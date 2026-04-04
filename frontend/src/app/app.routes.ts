import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { MarketsComponent } from './components/markets/markets.component';
import { PortfolioComponent } from './components/portfolio/portfolio.component';
import { CoinChart } from './components/coin-chart/coin-chart';
import { Watchlist } from './components/watchlist/watchlist';
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
    path: 'chart/:symbol',
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
