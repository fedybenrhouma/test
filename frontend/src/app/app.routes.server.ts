import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'chart/:symbol',
    renderMode: RenderMode.Client
  },
  {
    path: 'dashboard',
    renderMode: RenderMode.Client
  },
  {
    path: 'portfolio',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
