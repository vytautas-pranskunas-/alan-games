import { Injectable, computed, signal } from '@angular/core';
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { getDb } from './firebase';
import { TeamId, teamMeta } from './team.model';

/** Local calendar day key YYYY-MM-DD */
export function battleDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type BattleWinner = TeamId | 'tie';

export interface DailyBattleDay {
  date: string;
  dragon: number;
  toxic: number;
  winner: BattleWinner | null;
  finalizedAt: unknown | null;
}

/** Only used to recognize the same browser — votes live in Firestore. */
const VISITOR_KEY = 'alanas-visitor-id';
/** Winner is locked in at 21:00 local time. */
export const BATTLE_CLOSE_HOUR = 21;

function emptyDay(date: string): DailyBattleDay {
  return { date, dragon: 0, toxic: 0, winner: null, finalizedAt: null };
}

@Injectable({ providedIn: 'root' })
export class DailyTeamBattleService {
  readonly todayKey = battleDateKey();

  private readonly day = signal<DailyBattleDay | null>(null);
  private readonly myTeamToday = signal<TeamId | null>(null);
  private readonly spectatorTeam = signal<TeamId | null>(null);
  private readonly changingTeam = signal(false);
  private readonly ready = signal(false);
  private readonly error = signal<string | null>(null);
  private unsubDay: Unsubscribe | null = null;

  readonly status = computed(() => this.day());
  readonly votedTeam = computed(() => this.myTeamToday() ?? this.spectatorTeam());
  readonly hasVotedToday = computed(() => this.myTeamToday() !== null);
  readonly canEnterArcade = computed(
    () => this.myTeamToday() !== null || this.spectatorTeam() !== null,
  );
  readonly isReady = computed(() => this.ready());
  readonly battleError = computed(() => this.error());
  /** TEMP free switching while `environment.devFreeTeamSwitch` is true. */
  readonly freeSwitch = environment.devFreeTeamSwitch;
  readonly isChangingTeam = computed(() => this.changingTeam());
  readonly canVote = computed(
    () => this.freeSwitch || (!this.hasVotedToday() && !this.isPastCloseTime()),
  );

  /** Live leader from Firestore scores (no need to wait until 21:00). */
  readonly liveWinner = computed((): BattleWinner | null => {
    const day = this.day();
    if (!day) {
      return null;
    }
    if (day.winner) {
      return day.winner;
    }
    if (day.dragon === 0 && day.toxic === 0) {
      return null;
    }
    return this.pickWinner(day.dragon, day.toxic);
  });

  readonly winnerMeta = computed(() => {
    const w = this.liveWinner();
    if (!w || w === 'tie') {
      return null;
    }
    return teamMeta(w);
  });

  readonly resultLabel = computed(() => {
    if (this.isPastCloseTime() || this.day()?.winner) {
      return 'Won today';
    }
    return 'Leading';
  });

  /** Scores with the visitor's chosen team listed first. */
  readonly scoresLabel = computed(() => {
    const day = this.day();
    if (!day) {
      return 'Connecting to Firebase…';
    }
    const mine = this.votedTeam();
    if (mine === 'toxic') {
      return `Toxic ${day.toxic} · Dragon ${day.dragon}`;
    }
    // Default / dragon first when on Dragon or not yet chosen
    return `Dragon ${day.dragon} · Toxic ${day.toxic}`;
  });


  constructor() {
    void this.bootstrap();
  }

  async bootstrap(): Promise<void> {
    try {
      const visitorId = this.ensureVisitorId();
      const date = this.todayKey;
      await this.ensureDayDoc(date);
      await this.loadMyBallot(date, visitorId);
      this.watchDay(date);
      if (this.isPastCloseTime()) {
        await this.finalizeWinnerIfNeeded(date);
      }
      this.error.set(null);
    } catch (err) {
      console.error('Daily battle bootstrap failed', err);
      this.error.set(
        'Could not reach Firebase Firestore. Check the project, rules, and network — then refresh.',
      );
    } finally {
      this.ready.set(true);
    }
  }

  enterAsSpectator(): { ok: boolean; reason?: string } {
    if (!this.isPastCloseTime()) {
      return { ok: false, reason: 'Spectator mode opens after 21:00.' };
    }
    if (this.myTeamToday()) {
      return { ok: true };
    }
    const day = this.day();
    const winner = day?.winner ?? this.pickWinner(day?.dragon ?? 0, day?.toxic ?? 0);
    const team: TeamId = winner === 'tie' || !winner ? 'dragon' : winner;
    this.spectatorTeam.set(team);
    return { ok: true };
  }

  /**
   * Dev: open the picker to switch teams without removing your vote first.
   * Picking another team moves the same single vote (−1 old, +1 new).
   */
  beginTeamChange(): void {
    if (!this.freeSwitch) {
      return;
    }
    this.changingTeam.set(true);
  }

  /**
   * Cast / switch team vote in Firestore (ballot + score increment).
   * With `devFreeTeamSwitch`, you can change teams as often as you want.
   */
  async vote(team: TeamId): Promise<{ ok: boolean; reason?: string }> {
    const current = this.myTeamToday();
    if (!this.freeSwitch) {
      if (current) {
        return { ok: false, reason: 'You already chose a team today.' };
      }
      if (this.isPastCloseTime()) {
        return { ok: false, reason: 'Voting closed at 21:00. Come back tomorrow!' };
      }
    } else if (current === team) {
      return { ok: true };
    }

    const visitorId = this.ensureVisitorId();
    const date = this.todayKey;

    try {
      const db = getDb();
      const ballotRef = doc(db, 'ballots', `${date}_${visitorId}`);
      const dayRef = doc(db, 'dailyBattles', date);

      const nextDay = await runTransaction(db, async (tx) => {
        const ballotSnap = await tx.get(ballotRef);
        const previous = ballotSnap.exists()
          ? (ballotSnap.data()['team'] as TeamId | undefined)
          : undefined;

        if (!this.freeSwitch && ballotSnap.exists()) {
          throw new Error('ALREADY_VOTED');
        }

        const daySnap = await tx.get(dayRef);
        const data = (daySnap.data() as DailyBattleDay | undefined) ?? emptyDay(date);
        if (!this.freeSwitch && data.winner) {
          throw new Error('CLOSED');
        }

        let dragon = Number(data.dragon) || 0;
        let toxic = Number(data.toxic) || 0;

        if (previous === 'dragon') {
          dragon = Math.max(0, dragon - 1);
        } else if (previous === 'toxic') {
          toxic = Math.max(0, toxic - 1);
        }

        if (team === 'dragon') {
          dragon += 1;
        } else {
          toxic += 1;
        }

        const next: DailyBattleDay = {
          date,
          dragon,
          toxic,
          winner: this.freeSwitch ? null : (data.winner ?? null),
          finalizedAt: this.freeSwitch ? null : (data.finalizedAt ?? null),
        };

        tx.set(ballotRef, {
          date,
          visitorId,
          team,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        tx.set(dayRef, next, { merge: true });
        return next;
      });

      this.myTeamToday.set(team);
      this.spectatorTeam.set(null);
      this.changingTeam.set(false);
      this.day.set(nextDay);
      this.error.set(null);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('ALREADY_VOTED')) {
        await this.loadMyBallot(date, visitorId);
        return { ok: false, reason: 'You already chose a team today.' };
      }
      if (message.includes('CLOSED')) {
        return { ok: false, reason: 'Today’s battle is already finished.' };
      }
      console.error('Firestore vote failed', err);
      this.error.set('Could not save your team to Firebase. Please try again.');
      return {
        ok: false,
        reason: 'Could not save your team to Firebase. Please try again.',
      };
    }
  }

  isPastCloseTime(now = new Date()): boolean {
    return now.getHours() >= BATTLE_CLOSE_HOUR;
  }

  private pickWinner(dragon: number, toxic: number): BattleWinner {
    if (dragon === toxic) {
      return 'tie';
    }
    return dragon > toxic ? 'dragon' : 'toxic';
  }

  private async ensureDayDoc(date: string): Promise<void> {
    const ref = doc(getDb(), 'dailyBattles', date);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const created = emptyDay(date);
      await setDoc(ref, created);
      this.day.set(created);
      return;
    }
    this.day.set(this.normalizeDay(snap.data() as DailyBattleDay));
  }

  private watchDay(date: string): void {
    this.unsubDay?.();
    this.unsubDay = onSnapshot(
      doc(getDb(), 'dailyBattles', date),
      (snap) => {
        if (snap.exists()) {
          this.day.set(this.normalizeDay(snap.data() as DailyBattleDay));
        }
      },
      (err) => {
        console.warn('Day watch failed', err);
        this.error.set('Lost live Firebase updates. Refresh the page.');
      },
    );
  }

  private async loadMyBallot(date: string, visitorId: string): Promise<void> {
    const snap = await getDoc(doc(getDb(), 'ballots', `${date}_${visitorId}`));
    if (snap.exists()) {
      const team = snap.data()['team'] as TeamId;
      if (team === 'dragon' || team === 'toxic') {
        this.myTeamToday.set(team);
      }
    }
  }

  private async finalizeWinnerIfNeeded(date: string): Promise<void> {
    const db = getDb();
    const dayRef = doc(db, 'dailyBattles', date);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(dayRef);
        if (!snap.exists()) {
          return;
        }
        const data = snap.data() as DailyBattleDay;
        if (data.winner) {
          return;
        }
        const winner = this.pickWinner(Number(data.dragon) || 0, Number(data.toxic) || 0);
        tx.set(
          dayRef,
          {
            winner,
            finalizedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });
    } catch (err) {
      console.warn('Could not finalize winner yet', err);
    }
  }

  private normalizeDay(day: DailyBattleDay): DailyBattleDay {
    return {
      date: day.date,
      dragon: Number(day.dragon) || 0,
      toxic: Number(day.toxic) || 0,
      winner: day.winner ?? null,
      finalizedAt: day.finalizedAt ?? null,
    };
  }

  private ensureVisitorId(): string {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }
}
