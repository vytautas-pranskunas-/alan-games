import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { IdeasService } from '../../ideas/ideas.service';

interface IdeaDraft {
  nickname: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-ideas-page',
  imports: [FormField, DatePipe],
  templateUrl: './ideas-page.html',
  styleUrl: './ideas-page.scss',
})
export class IdeasPage {
  private readonly ideas = inject(IdeasService);

  protected readonly board = this.ideas.board;
  protected readonly ideasError = this.ideas.ideasError;
  protected readonly submitted = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly saving = signal(false);

  private readonly draft = signal<IdeaDraft>({
    nickname: '',
    title: '',
    description: '',
  });

  protected readonly ideaForm = form(this.draft, (p) => {
    required(p.nickname, { message: 'Please enter a nickname' });
    maxLength(p.nickname, 40, { message: 'Nickname is too long (max 40)' });
    required(p.title, { message: 'Please enter a title' });
    maxLength(p.title, 80, { message: 'Title is too long (max 80)' });
    required(p.description, { message: 'Please describe your idea' });
    maxLength(p.description, 2000, { message: 'Description is too long (max 2000)' });
  });

  protected fieldError(field: 'nickname' | 'title' | 'description'): string | null {
    const state = this.ideaForm[field]();
    if (!state.touched() && !state.dirty()) {
      return null;
    }
    const first = state.errors()[0];
    return first?.message ?? (state.invalid() ? 'This field is required' : null);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitError.set(null);
    this.submitted.set(false);

    await submit(this.ideaForm, async () => {
      this.saving.set(true);
      try {
        const value = this.draft();
        const result = await this.ideas.submitIdea(value);
        if (!result.ok) {
          this.submitError.set(result.reason ?? 'Could not send idea.');
          return;
        }
        this.submitted.set(true);
        this.draft.set({
          nickname: '',
          title: '',
          description: '',
        });
      } finally {
        this.saving.set(false);
      }
    });
  }
}
