import type { BadgeTone } from '@/components/ui/primitives';
/* ------------------------------------------------------------------ *
 * Mastery model.
 *
 * Deliberately NOT time-based. Three hours staring at a lesson produces
 * `learning`, not `mastered`. What moves a topic up the ladder is:
 *
 *   1. the lesson is finished            → learning
 *   2. practice has happened             → practicing
 *   3. accuracy is decent and repeated   → strong
 *   4. accuracy is high AND recent       → mastered
 *
 * A self-assessment can only ever hold a topic back or leave it alone;
 * it can never promote one on its own.
 * ------------------------------------------------------------------ */

export type MasteryStatus = 'not-started' | 'learning' | 'practicing' | 'strong' | 'mastered';

export const MASTERY_ORDER: MasteryStatus[] = [
  'not-started',
  'learning',
  'practicing',
  'strong',
  'mastered',
];

export const MASTERY_LABEL: Record<MasteryStatus, string> = {
  'not-started': 'Not started',
  learning: 'Learning',
  practicing: 'Practicing',
  strong: 'Strong',
  mastered: 'Mastered',
};

/** Days after which a mastered topic starts to look stale. */
const STALE_AFTER_DAYS = 45;

export interface MasteryInput {
  lessonDone: boolean;
  practiceTotal: number;
  practiceCorrect: number;
  recentTotal: number;
  recentCorrect: number;
  selfRating?: number | null;
  lastReviewedAt?: string | Date | null;
  now?: Date;
}

export interface MasteryResult {
  status: MasteryStatus;
  /** 1-5, for the segmented meter in the UI. */
  rung: number;
  accuracy: number | null;
  recentAccuracy: number | null;
  reasons: string[];
}

export function computeMastery(input: MasteryInput): MasteryResult {
  const {
    lessonDone,
    practiceTotal,
    practiceCorrect,
    recentTotal,
    recentCorrect,
    selfRating,
    lastReviewedAt,
    now = new Date(),
  } = input;

  const accuracy = practiceTotal ? practiceCorrect / practiceTotal : null;
  const recentAccuracy = recentTotal ? recentCorrect / recentTotal : null;
  const reasons: string[] = [];

  let status: MasteryStatus = 'not-started';

  if (practiceTotal >= 4 && accuracy !== null && accuracy >= 0.85 && recentTotal >= 3 && (recentAccuracy ?? 0) >= 0.8) {
    status = 'mastered';
    reasons.push(`Accuracy ${Math.round(accuracy * 100)}% over ${practiceTotal} attempts`);
    reasons.push(`Recent attempts ${Math.round((recentAccuracy ?? 0) * 100)}% correct`);
  } else if (practiceTotal >= 3 && accuracy !== null && accuracy >= 0.7) {
    status = 'strong';
    reasons.push(`Accuracy ${Math.round(accuracy * 100)}% over ${practiceTotal} attempts`);
  } else if (practiceTotal > 0) {
    status = 'practicing';
    reasons.push(
      accuracy !== null
        ? `${practiceCorrect}/${practiceTotal} correct so far`
        : `${practiceTotal} attempts so far`,
    );
  } else if (lessonDone) {
    status = 'learning';
    reasons.push('Lesson completed — no practice yet');
  } else {
    reasons.push('No lesson or practice recorded');
  }

  if (!lessonDone && status !== 'not-started') {
    reasons.push('Lesson not yet marked complete');
  }

  // Recency: a mastered topic nobody has revisited for a while is demoted,
  // because "mastered" should mean "still solid", not "was solid in March".
  if (status === 'mastered' && lastReviewedAt) {
    const last = typeof lastReviewedAt === 'string' ? new Date(lastReviewedAt) : lastReviewedAt;
    const days = (now.getTime() - last.getTime()) / 86_400_000;
    if (days > STALE_AFTER_DAYS) {
      status = 'strong';
      reasons.push(`Last reviewed ${Math.round(days)} days ago`);
    }
  }

  // Self-assessment can hold you back, never carry you.
  if (selfRating !== null && selfRating !== undefined && selfRating <= 2 && status === 'strong') {
    status = 'practicing';
    reasons.push('You rated your confidence low');
  }
  if (selfRating !== null && selfRating !== undefined && selfRating <= 2 && status === 'mastered') {
    status = 'strong';
    reasons.push('You rated your confidence low');
  }

  return {
    status,
    rung: MASTERY_ORDER.indexOf(status) + 1,
    accuracy,
    recentAccuracy,
    reasons,
  };
}

export function masteryTone(status: MasteryStatus): BadgeTone {
  switch (status) {
    case 'mastered':
      return 'good';
    case 'strong':
      return 'accent';
    case 'practicing':
      return 'ochre';
    case 'learning':
      return 'info';
    default:
      return 'muted';
  }
}
