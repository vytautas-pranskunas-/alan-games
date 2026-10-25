import { Routes } from '@angular/router';
import { teamRequiredGuard } from './core/team.guard';
import { Shell } from './shared/shell/shell';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/team-picker/team-picker').then((m) => m.TeamPicker),
  },
  {
    path: '',
    component: Shell,
    canActivate: [teamRequiredGuard],
    children: [
      {
        path: 'games',
        loadComponent: () =>
          import('./features/games/games-page').then((m) => m.GamesPage),
      },
      {
        path: 'play/:slug',
        loadComponent: () =>
          import('./features/play/play-page').then((m) => m.PlayPage),
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./features/about/about-page').then((m) => m.AboutPage),
      },
      {
        path: 'ideas',
        loadComponent: () =>
          import('./features/ideas/ideas-page').then((m) => m.IdeasPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
