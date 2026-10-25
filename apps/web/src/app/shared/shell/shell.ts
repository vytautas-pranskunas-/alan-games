import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DailyTeamBattleService } from '../../core/daily-team-battle.service';
import { TeamService } from '../../core/team.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly teams = inject(TeamService);
  protected readonly battle = inject(DailyTeamBattleService);
}
