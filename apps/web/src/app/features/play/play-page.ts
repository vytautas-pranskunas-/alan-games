import { Component, computed, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { GamesService } from '../../games/games.service';

@Component({
  selector: 'app-play-page',
  imports: [RouterLink],
  templateUrl: './play-page.html',
  styleUrl: './play-page.scss',
})
export class PlayPage {
  private readonly route = inject(ActivatedRoute);
  private readonly games = inject(GamesService);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly slug = toSignal(this.route.paramMap.pipe(map((p) => p.get('slug') ?? '')), {
    initialValue: '',
  });

  protected readonly game = computed(() => {
    const slug = this.slug();
    return slug ? this.games.getBySlug(slug) : undefined;
  });

  protected readonly safeSrc = computed(() => {
    const game = this.game();
    if (!game) {
      return null;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.games.playUrl(game));
  });
}
