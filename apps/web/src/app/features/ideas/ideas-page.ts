import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { createBotChallenge, isCorrectChallengeAnswer } from '../../ideas/bot-challenge';
import { IdeasService } from '../../ideas/ideas.service';

interface IdeaDraft {
  nickname: string;
  title: string;
  description: string;
  /** Honeypot — must stay empty. */
  website: string;
  botAnswer: string;
}

@Component({
  selector: 'app-ideas-page',
  imports: [FormField, DatePipe],
  templateUrl: './ideas-page.html',
  styleUrl: './ideas-page.scss',
})
export class IdeasPage {
  private readonly ideas = inject(IdeasService);
  private readonly openedAt = Date.now();

  protected readonly board = this.ideas.board;
  protected readonly ideasError = this.ideas.ideasError;
  protected readonly submitted = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly challenge = signal(createBotChallenge());

  private readonly draft = signal<IdeaDraft>({
    nickname: '',
    title: '',
    description: '',
    website: '',
    botAnswer: '',
  });

  protected readonly ideaForm = form(this.draft, (p) => {
    required(p.nickname, { message: 'Please enter a nickname' });
    maxLength(p.nickname, 40, { message: 'Nickname is too long (max 40)' });
    required(p.title, { message: 'Please enter a title' });
    maxLength(p.title, 80, { message: 'Title is too long (max 80)' });
    required(p.description, { message: 'Please describe your idea' });
    maxLength(p.description, 2000, { message: 'Description is too long (max 2000)' });
    required(p.botAnswer, { message: 'Solve the bot check' });
    validate(p.botAnswer, ({ value }) => {
      const raw = String(value() ?? '').trim();
      if (!raw) {
        return undefined;
      }
      if (!isCorrectChallengeAnswer(raw, this.challenge().answer)) {
        return { kind: 'botChallenge', message: 'Wrong answer — try again' };
      }
      return undefined;
    });
  });

  protected fieldError(
    field: 'nickname' | 'title' | 'description' | 'botAnswer',
  ): string | null {
    const state = this.ideaForm[field]();
    if (!state.touched() && !state.dirty()) {
      return null;
    }
    const first = state.errors()[0];
    return first?.message ?? (state.invalid() ? 'This field is required' : null);
  }

  protected refreshChallenge(): void {
    this.challenge.set(createBotChallenge());
    this.draft.update((d) => ({ ...d, botAnswer: '' }));
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitError.set(null);
    this.submitted.set(false);

    await submit(this.ideaForm, async () => {
      const value = this.draft();

      // Honeypot: real users never see/fill this.
      if (value.website.trim()) {
        this.submitError.set('Could not send idea.');
        this.refreshChallenge();
        return;
      }

      // Too-fast submits are usually bots.
      if (Date.now() - this.openedAt < 2500) {
        this.submitError.set('Please take a moment to fill the form, then try again.');
        return;
      }

      if (!isCorrectChallengeAnswer(value.botAnswer, this.challenge().answer)) {
        this.submitError.set('Wrong bot-check answer — try again.');
        this.refreshChallenge();
        return;
      }

      this.saving.set(true);
      try {
        const result = await this.ideas.submitIdea({
          nickname: value.nickname,
          title: value.title,
          description: value.description,
        });
        if (!result.ok) {
          this.submitError.set(result.reason ?? 'Could not send idea.');
          return;
        }
        this.submitted.set(true);
        this.draft.set({
          nickname: '',
          title: '',
          description: '',
          website: '',
          botAnswer: '',
        });
        this.refreshChallenge();
      } finally {
        this.saving.set(false);
      }
    });
  }
}
