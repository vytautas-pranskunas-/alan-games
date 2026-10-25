import { Injectable, computed, signal } from '@angular/core';
import { GAMES_MANIFEST } from './games.manifest';
import { GameMeta } from './game.model';

@Injectable({ providedIn: 'root' })
export class GamesService {
  private readonly allGames = signal<GameMeta[]>([...GAMES_MANIFEST]);
  readonly genreFilter = signal<string>('all');

  readonly genres = computed(() => {
    const set = new Set(this.allGames().map((g) => g.genre.toLowerCase()));
    return ['all', ...Array.from(set).sort()];
  });

  readonly filteredGames = computed(() => {
    const filter = this.genreFilter();
    const games = this.allGames();
    if (filter === 'all') {
      return games;
    }
    return games.filter((g) => g.genre.toLowerCase() === filter);
  });

  readonly totalCount = computed(() => this.allGames().length);

  getBySlug(slug: string): GameMeta | undefined {
    return this.allGames().find((g) => g.slug === slug);
  }

  coverUrl(game: GameMeta): string {
    return `/assets/games/${game.slug}/${game.cover}`;
  }

  playUrl(game: GameMeta): string {
    return `/assets/games/${game.slug}/${game.entry}`;
  }

  setGenre(genre: string): void {
    this.genreFilter.set(genre);
  }
}
