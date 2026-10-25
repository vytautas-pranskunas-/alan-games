import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { AuthService } from '../core/auth.service';
import { getDb } from '../core/firebase';
import { Idea, IdeaStatus } from './idea.model';

export interface SubmitIdeaInput {
  nickname: string;
  title: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class IdeasService {
  private readonly auth = inject(AuthService);
  private readonly ideas = signal<Idea[]>([]);
  private readonly ready = signal(false);
  private readonly error = signal<string | null>(null);
  private unsub: Unsubscribe | null = null;

  /** Public board — approved ideas only. */
  readonly board = computed(() =>
    sortIdeas(this.ideas().filter((idea) => idea.status === 'published')),
  );

  /** Pending queue — only meaningful when signed in as admin. */
  readonly pending = computed(() =>
    sortIdeas(this.ideas().filter((idea) => idea.status === 'pending')),
  );

  /** @deprecated use board */
  readonly published = this.board;

  readonly isReady = computed(() => this.ready());
  readonly ideasError = computed(() => this.error());

  constructor() {
    effect(() => {
      // Re-subscribe when admin status changes (rules allow different queries).
      const admin = this.auth.isAdmin();
      const authReady = this.auth.ready();
      if (!authReady) {
        return;
      }
      this.watchIdeas(admin);
    });
  }

  private watchIdeas(asAdmin: boolean): void {
    this.unsub?.();
    this.ready.set(false);

    const ideasRef = collection(getDb(), 'ideas');
    const q = asAdmin ? ideasRef : query(ideasRef, where('status', '==', 'published'));

    this.unsub = onSnapshot(
      q,
      (snap) => {
        const list: Idea[] = snap.docs.map((docSnap) => this.mapDoc(docSnap.id, docSnap.data()));
        this.ideas.set(list);
        this.error.set(null);
        this.ready.set(true);
      },
      (err) => {
        console.error('Ideas watch failed', err);
        this.error.set('Could not load ideas from Firebase.');
        this.ready.set(true);
      },
    );
  }

  async submitIdea(input: SubmitIdeaInput): Promise<{ ok: boolean; reason?: string }> {
    const nickname = input.nickname.trim();
    const title = input.title.trim();
    const body = input.description.trim();

    if (!nickname || !title || !body) {
      return { ok: false, reason: 'Please fill in nickname, title, and description.' };
    }

    try {
      const today = new Date();
      const date = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-');

      await addDoc(collection(getDb(), 'ideas'), {
        nickname,
        title,
        body,
        status: 'pending' satisfies IdeaStatus,
        date,
        submittedAt: serverTimestamp(),
      });

      this.error.set(null);
      return { ok: true };
    } catch (err) {
      console.error('Idea submit failed', err);
      this.error.set('Could not save idea to Firebase.');
      return { ok: false, reason: 'Could not save idea to Firebase. Please try again.' };
    }
  }

  async approveIdea(id: string): Promise<{ ok: boolean; reason?: string }> {
    if (!this.auth.isAdmin()) {
      return { ok: false, reason: 'Sign in as moderator to approve ideas.' };
    }
    try {
      await updateDoc(doc(getDb(), 'ideas', id), { status: 'published' satisfies IdeaStatus });
      return { ok: true };
    } catch (err) {
      console.error('Approve failed', err);
      return { ok: false, reason: 'Could not approve idea.' };
    }
  }

  async deleteIdea(id: string): Promise<{ ok: boolean; reason?: string }> {
    if (!this.auth.isAdmin()) {
      return { ok: false, reason: 'Sign in as moderator to delete ideas.' };
    }
    try {
      await deleteDoc(doc(getDb(), 'ideas', id));
      return { ok: true };
    } catch (err) {
      console.error('Delete failed', err);
      return { ok: false, reason: 'Could not delete idea.' };
    }
  }

  private mapDoc(id: string, data: Record<string, unknown>): Idea {
    const status = data['status'] === 'pending' ? 'pending' : 'published';
    return {
      id,
      title: String(data['title'] ?? ''),
      nickname: String(data['nickname'] ?? ''),
      body: String(data['body'] ?? data['description'] ?? ''),
      status,
      date: String(data['date'] ?? ''),
      submittedAt: data['submittedAt'],
    };
  }
}

function sortIdeas(list: Idea[]): Idea[] {
  return [...list].sort((a, b) => {
    const ta = ideaSortKey(a);
    const tb = ideaSortKey(b);
    return ta < tb ? 1 : ta > tb ? -1 : 0;
  });
}

function ideaSortKey(idea: Idea): string {
  const submitted = idea.submittedAt as
    | { toMillis?: () => number; seconds?: number }
    | string
    | undefined;
  if (submitted && typeof submitted === 'object') {
    if (typeof submitted.toMillis === 'function') {
      return String(submitted.toMillis());
    }
    if (typeof submitted.seconds === 'number') {
      return String(submitted.seconds * 1000);
    }
  }
  return idea.date || idea.id;
}
