/* Grading rules, kept out of the server-action module so they can be
 * imported from the client and from tests without pulling in `'use server'`.
 *
 * Every export in a `'use server'` file has to be an async function, so a
 * pure helper cannot live there. */

export interface GradableQuestion {
  kind: string;
  answer: unknown;
  choices: string[];
}

/**
 * Grade an answer against the authored key.
 *
 * MCQ is exact; short-answer accepts any of the listed keywords; FRQ is
 * never auto-graded, because pretending to grade an essay would be worse
 * than leaving it to the student against the published rubric.
 *
 * Returns `null` when the kind cannot be auto-graded — callers must not
 * read that as "wrong".
 */
export function gradeAnswer(question: GradableQuestion, answer: unknown): boolean | null {
  if (question.kind === 'mcq') {
    if (answer === null || answer === undefined || answer === '') return null;
    const index = Number(answer);
    if (!Number.isFinite(index)) return null;
    return index === Number(question.answer);
  }
  if (question.kind === 'short-answer') {
    const accepted = acceptedTerms(question);
    const text = String(answer ?? '').toLowerCase().trim();
    if (!text) return null;
    if (!accepted.length) return null;
    return accepted.some((term) => text.includes(term.toLowerCase()));
  }
  return null;
}

/** Accepted substrings for a short-answer key; empty for other kinds. */
export function acceptedTerms(question: GradableQuestion): string[] {
  const answer = question.answer;
  if (Array.isArray(answer)) return answer.map(String);
  if (answer && typeof answer === 'object') {
    const record = answer as Record<string, unknown>;
    if (Array.isArray(record.accepted)) return (record.accepted as unknown[]).map(String);
  }
  return [];
}
