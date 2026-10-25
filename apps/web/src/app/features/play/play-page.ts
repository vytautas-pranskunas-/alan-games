import { Component, computed, ElementRef, inject, OnDestroy, OnInit } from '@angular/core';
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
export class PlayPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly games = inject(GamesService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly host = inject(ElementRef<HTMLElement>);

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

  private disarm: (() => void) | null = null;

  ngOnInit(): void {
    if (typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches) {
      return;
    }

    const arm = () => {
      const el = this.host.nativeElement.querySelector('.play') as HTMLElement | null;
      if (!el || document.fullscreenElement) {
        return;
      }
      const req =
        el.requestFullscreen?.bind(el) ??
        (
          el as HTMLElement & {
            webkitRequestFullscreen?: () => Promise<void>;
          }
        ).webkitRequestFullscreen?.bind(el);
      void Promise.resolve(req?.()).catch(() => undefined);
    };

    document.addEventListener('pointerdown', arm, { once: true, capture: true });
    this.disarm = () => document.removeEventListener('pointerdown', arm, true);
  }

  ngOnDestroy(): void {
    this.disarm?.();
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }
}
