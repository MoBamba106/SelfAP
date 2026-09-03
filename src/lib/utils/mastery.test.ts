import { describe, expect, it } from 'vitest';
import { MASTERY_ORDER, computeMastery } from './mastery';

const NOW = new Date('2026-09-03T12:00:00Z');

describe('computeMastery', () => {
  it('starts at not-started with nothing recorded', () => {
    const result = computeMastery({
      lessonDone: false,
      practiceTotal: 0,
      practiceCorrect: 0,
      recentTotal: 0,
      recentCorrect: 0,
      now: NOW,
    });
    expect(result.status).toBe('not-started');
    expect(result.rung).toBe(1);
    expect(result.accuracy).toBeNull();
  });

  it('moves to learning on lesson completion alone', () => {
    const result = computeMastery({
      lessonDone: true,
      practiceTotal: 0,
      practiceCorrect: 0,
      recentTotal: 0,
      recentCorrect: 0,
      now: NOW,
    });
    expect(result.status).toBe('learning');
    expect(result.rung).toBe(2);
  });

  it('is not purely time-based: a finished lesson with no practice never reaches strong', () => {
    const result = computeMastery({
      lessonDone: true,
      practiceTotal: 0,
      practiceCorrect: 0,
      recentTotal: 0,
      recentCorrect: 0,
      selfRating: 5,
      lastReviewedAt: NOW,
      now: NOW,
    });
    expect(MASTERY_ORDER.indexOf(result.status)).toBeLessThan(MASTERY_ORDER.indexOf('strong'));
  });

  it('reaches practicing on any attempt', () => {
    const result = computeMastery({
      lessonDone: true,
      practiceTotal: 1,
      practiceCorrect: 0,
      recentTotal: 1,
      recentCorrect: 0,
      now: NOW,
    });
    expect(result.status).toBe('practicing');
  });

  it('needs three attempts at 70% for strong', () => {
    const below = computeMastery({
      lessonDone: true,
      practiceTotal: 2,
      practiceCorrect: 2,
      recentTotal: 2,
      recentCorrect: 2,
      now: NOW,
    });
    expect(below.status).toBe('practicing');

    const at = computeMastery({
      lessonDone: true,
      practiceTotal: 3,
      practiceCorrect: 3,
      recentTotal: 3,
      recentCorrect: 3,
      now: NOW,
    });
    expect(at.status).toBe('strong');
  });

  it('needs four attempts, 85% overall and three recent at 80% for mastered', () => {
    const notEnoughAttempts = computeMastery({
      lessonDone: true,
      practiceTotal: 3,
      practiceCorrect: 3,
      recentTotal: 3,
      recentCorrect: 3,
      now: NOW,
    });
    expect(notEnoughAttempts.status).toBe('strong');

    const weakRecent = computeMastery({
      lessonDone: true,
      practiceTotal: 10,
      practiceCorrect: 9,
      recentTotal: 3,
      recentCorrect: 2, // 67% recent — below the 80% bar
      now: NOW,
    });
    expect(weakRecent.status).toBe('strong');

    const mastered = computeMastery({
      lessonDone: true,
      practiceTotal: 10,
      practiceCorrect: 9,
      recentTotal: 3,
      recentCorrect: 3,
      now: NOW,
    });
    expect(mastered.status).toBe('mastered');
    expect(mastered.rung).toBe(5);
  });

  it('demotes mastered to strong once it goes stale', () => {
    const fresh = computeMastery({
      lessonDone: true,
      practiceTotal: 10,
      practiceCorrect: 9,
      recentTotal: 3,
      recentCorrect: 3,
      lastReviewedAt: new Date(NOW.getTime() - 10 * 86_400_000),
      now: NOW,
    });
    expect(fresh.status).toBe('mastered');

    const stale = computeMastery({
      lessonDone: true,
      practiceTotal: 10,
      practiceCorrect: 9,
      recentTotal: 3,
      recentCorrect: 3,
      lastReviewedAt: new Date(NOW.getTime() - 60 * 86_400_000),
      now: NOW,
    });
    expect(stale.status).toBe('strong');
    expect(stale.reasons.join(' ')).toMatch(/days ago/);
  });

  it('lets a low self-rating hold a topic back', () => {
    const held = computeMastery({
      lessonDone: true,
      practiceTotal: 3,
      practiceCorrect: 3,
      recentTotal: 3,
      recentCorrect: 3,
      selfRating: 2,
      now: NOW,
    });
    expect(held.status).toBe('practicing');
  });

  it('never lets a high self-rating promote a topic', () => {
    const result = computeMastery({
      lessonDone: false,
      practiceTotal: 0,
      practiceCorrect: 0,
      recentTotal: 0,
      recentCorrect: 0,
      selfRating: 5,
      now: NOW,
    });
    expect(result.status).toBe('not-started');
  });

  it('reports accuracy as null rather than zero when there is nothing to grade', () => {
    const result = computeMastery({
      lessonDone: true,
      practiceTotal: 0,
      practiceCorrect: 0,
      recentTotal: 0,
      recentCorrect: 0,
      now: NOW,
    });
    expect(result.accuracy).toBeNull();
    expect(result.recentAccuracy).toBeNull();
  });
});
