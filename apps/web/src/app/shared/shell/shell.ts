import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { DailyTeamBattleService } from '../../core/daily-team-battle.service';
import { TeamService } from '../../core/team.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: {
    '[class.shell--playing]': 'playing()',
  },
})
export class Shell {
  protected readonly teams = inject(TeamService);
  protected readonly battle = inject(DailyTeamBattleService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly menuOpen = signal(false);
  protected readonly playing = signal(this.isPlayUrl(this.router.url));

  constructor() {
    effect(() => {
      if (typeof document === 'undefined') {
        return;
      }
      document.body.style.overflow = this.menuOpen() || this.playing() ? 'hidden' : '';
      document.body.classList.toggle('playing-game', this.playing());
    });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.closeMenu();
        this.playing.set(this.isPlayUrl(event.urlAfterRedirects));
      });
  }

  private isPlayUrl(url: string): boolean {
    return url.split('?')[0].startsWith('/play');
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
