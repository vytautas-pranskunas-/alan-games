import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GamesService } from '../../games/games.service';

@Component({
  selector: 'app-games-page',
  imports: [RouterLink, DatePipe],
  templateUrl: './games-page.html',
  styleUrl: './games-page.scss',
})
export class GamesPage {
  protected readonly games = inject(GamesService);
}
