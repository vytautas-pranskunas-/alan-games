import { Component, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { DailyTeamBattleService } from '../../core/daily-team-battle.service';
import { TeamId, TeamService } from '../../core/team.service';

@Component({
  selector: 'app-team-picker',
  templateUrl: './team-picker.html',
  styleUrl: './team-picker.scss',
})
export class TeamPicker {
  private readonly teams = inject(TeamService);
  private readonly battle = inject(DailyTeamBattleService);
  private readonly router = inject(Router);

  protected readonly options = this.teams.teams;
  protected readonly battleState = this.battle;
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);

  constructor() {
    effect(() => {
      // While changing teams in dev mode, stay on the picker.
      if (
        this.battle.isReady() &&
        this.teams.hasTeam() &&
        !this.battle.isChangingTeam()
      ) {
        untracked(() => void this.router.navigateByUrl('/games'));
      }
    });
  }

  async choose(id: TeamId): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.message.set(null);
    try {
      const result = await this.teams.selectTeam(id);
      if (result.ok) {
        void this.router.navigateByUrl('/games');
        return;
      }
      this.message.set(result.reason ?? 'Could not join that team.');
      if (this.teams.hasTeam() && !this.battle.isChangingTeam()) {
        void this.router.navigateByUrl('/games');
      }
    } finally {
      this.busy.set(false);
    }
  }

  watchAsSpectator(): void {
    const result = this.teams.enterAsSpectator();
    if (result.ok) {
      void this.router.navigateByUrl('/games');
      return;
    }
    this.message.set(result.reason ?? 'Spectator mode unavailable.');
  }
}
