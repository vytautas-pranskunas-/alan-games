import { Injectable, computed, effect, inject } from '@angular/core';
import { DailyTeamBattleService } from './daily-team-battle.service';
import { TEAMS, TeamId, TeamMeta, teamMeta } from './team.model';

export type { TeamId, TeamMeta };
export { teamMeta, TEAMS };

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly battle = inject(DailyTeamBattleService);

  readonly teams = Object.values(TEAMS);

  /** Today's locked team choice (one vote per calendar day). */
  readonly team = computed(() => {
    const id = this.battle.votedTeam();
    return id ? TEAMS[id] : null;
  });

  readonly hasTeam = computed(() => this.battle.canEnterArcade());

  constructor() {
    effect(() => {
      const id = this.battle.votedTeam();
      if (typeof document === 'undefined') {
        return;
      }
      if (id) {
        document.documentElement.setAttribute('data-team', id);
      } else {
        document.documentElement.removeAttribute('data-team');
      }
    });
  }

  readonly freeSwitch = this.battle.freeSwitch;
  readonly isChangingTeam = this.battle.isChangingTeam;

  async selectTeam(id: TeamId): Promise<{ ok: boolean; reason?: string }> {
    return this.battle.vote(id);
  }

  enterAsSpectator(): { ok: boolean; reason?: string } {
    return this.battle.enterAsSpectator();
  }

  beginTeamChange(): void {
    this.battle.beginTeamChange();
  }
}
