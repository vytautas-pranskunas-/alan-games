import { Injectable, computed, signal } from '@angular/core';
import {
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from '../core/firebase';
import { Idea, IdeaStatus } from './idea.model';

export interface SubmitIdeaInput {
  nickname: string;
  title: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class IdeasService {
  private readonly ideas = signal<Idea[]>([]);
  private readonly ready = signal(false);
  private readonly error = signal<string | null>(null);
  private unsub: Unsubscribe | null = null;

  /** Live board — all ideas from Firestore, newest first. */
  readonly board = computed(() =>
    [...this.ideas()].sort((a, b) => {
      const ta = ideaSortKey(a);
      const tb = ideaSortKey(b);
      return ta < tb ? 1 : ta > tb ? -1 : 0;
    }),
  );

  /** @deprecated use board — kept for older templates */
  readonly published = this.board;

  readonly isReady = computed(() => this.ready());
  readonly ideasError = computed(() => this.error());

  constructor() {
    this.watchIdeas();
  }

  private watchIdeas(): void {
    this.unsub?.();
    this.unsub = onSnapshot(
      collection(getDb(), 'ideas'),
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

      // Published immediately so the board updates in real time.
      await addDoc(collection(getDb(), 'ideas'), {
        nickname,
        title,
        body,
        status: 'published' satisfies IdeaStatus,
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

function ideaSortKey(idea: Idea): string {
  const submitted = idea.submittedAt as { toMillis?: () => number; seconds?: number } | string | undefined;
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
