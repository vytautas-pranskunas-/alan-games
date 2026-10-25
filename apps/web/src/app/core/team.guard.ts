import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TeamService } from './team.service';

export const teamRequiredGuard: CanActivateFn = () => {
  const teams = inject(TeamService);
  const router = inject(Router);
  if (teams.hasTeam()) {
    return true;
  }
  return router.createUrlTree(['/']);
};
