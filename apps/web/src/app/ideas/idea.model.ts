export type IdeaStatus = 'pending' | 'published';

export interface Idea {
  id: string;
  title: string;
  nickname: string;
  body: string;
  status: IdeaStatus;
  /** YYYY-MM-DD for display */
  date: string;
  submittedAt?: unknown;
}

/** @deprecated use Idea */
export type PublishedIdea = Idea;
