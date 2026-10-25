export interface BotChallenge {
  prompt: string;
  answer: number;
}

/** Simple arithmetic check — kids can solve it, scrapers usually can't. */
export function createBotChallenge(): BotChallenge {
  const a = 2 + Math.floor(Math.random() * 8); // 2–9
  const b = 1 + Math.floor(Math.random() * 8); // 1–8
  const subtract = Math.random() < 0.35 && a > b;

  if (subtract) {
    return {
      prompt: `${a} − ${b}`,
      answer: a - b,
    };
  }

  return {
    prompt: `${a} + ${b}`,
    answer: a + b,
  };
}

export function isCorrectChallengeAnswer(raw: string, expected: number): boolean {
  const trimmed = raw.trim();
  if (!/^\d{1,3}$/.test(trimmed)) {
    return false;
  }
  return Number(trimmed) === expected;
}
