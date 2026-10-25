import { Injectable, computed, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { environment } from '../../environments/environment';
import { getFirebaseAuth } from './firebase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSignal = signal<User | null>(null);
  private readonly readySignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly user = this.userSignal.asReadonly();
  readonly ready = this.readySignal.asReadonly();
  readonly authError = this.errorSignal.asReadonly();

  readonly isAdmin = computed(() => {
    const email = this.userSignal()?.email?.trim().toLowerCase();
    return email === environment.adminEmail.toLowerCase();
  });

  constructor() {
    onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (user && user.email?.trim().toLowerCase() !== environment.adminEmail.toLowerCase()) {
        await signOut(getFirebaseAuth());
        this.userSignal.set(null);
        this.errorSignal.set('Only the site moderator can sign in.');
        this.readySignal.set(true);
        return;
      }
      this.userSignal.set(user);
      this.errorSignal.set(null);
      this.readySignal.set(true);
    });
  }

  async signInWithGoogle(): Promise<void> {
    this.errorSignal.set(null);
    try {
      const result = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      const email = result.user.email?.trim().toLowerCase();
      if (email !== environment.adminEmail.toLowerCase()) {
        await signOut(getFirebaseAuth());
        this.errorSignal.set('Only the site moderator can sign in.');
      }
    } catch (err) {
      console.error('Google sign-in failed', err);
      this.errorSignal.set('Google sign-in failed. Please try again.');
    }
  }

  async signOut(): Promise<void> {
    this.errorSignal.set(null);
    await signOut(getFirebaseAuth());
  }
}
