import { describe, expect, it } from 'vitest';
import { acceptedTerms, gradeAnswer } from './grading';

describe('gradeAnswer — multiple choice', () => {
  const mcq = { kind: 'mcq', choices: ['a', 'b', 'c', 'd'], answer: 2 };

  it('matches the exact index', () => {
    expect(gradeAnswer(mcq, 2)).toBe(true);
    expect(gradeAnswer(mcq, 1)).toBe(false);
  });

  it('accepts a numeric string, since form data arrives as text', () => {
    expect(gradeAnswer(mcq, '2')).toBe(true);
    expect(gradeAnswer(mcq, '0')).toBe(false);
  });

  it('returns null, not false, when nothing was chosen', () => {
    expect(gradeAnswer(mcq, null)).toBeNull();
    expect(gradeAnswer(mcq, undefined)).toBeNull();
    expect(gradeAnswer(mcq, '')).toBeNull();
    expect(gradeAnswer(mcq, 'not-a-number')).toBeNull();
  });
});

describe('gradeAnswer — short answer', () => {
  const short = {
    kind: 'short-answer',
    choices: [],
    answer: { accepted: ['parameter', 'statistic'] },
  };

  it('accepts any listed term as a substring', () => {
    expect(gradeAnswer(short, 'that is a parameter')).toBe(true);
    expect(gradeAnswer(short, 'STATISTIC')).toBe(true);
  });

  it('rejects an unrelated answer', () => {
    expect(gradeAnswer(short, 'a sample mean')).toBe(false);
  });

  it('returns null for an empty answer rather than marking it wrong', () => {
    expect(gradeAnswer(short, '')).toBeNull();
    expect(gradeAnswer(short, '   ')).toBeNull();
  });

  it('returns null when the key lists no accepted terms', () => {
    expect(gradeAnswer({ kind: 'short-answer', choices: [], answer: {} }, 'anything')).toBeNull();
  });
});

describe('gradeAnswer — free response', () => {
  const frq = { kind: 'frq', choices: [], answer: { rubric: 'Shape, centre, spread, outliers.' } };

  it('is never auto-graded, whatever the student wrote', () => {
    expect(gradeAnswer(frq, 'Shape, centre, spread, outliers.')).toBeNull();
    expect(gradeAnswer(frq, '')).toBeNull();
  });
});

describe('acceptedTerms', () => {
  it('reads the accepted list from an object key', () => {
    expect(acceptedTerms({ kind: 'short-answer', choices: [], answer: { accepted: ['a', 'b'] } })).toEqual([
      'a',
      'b',
    ]);
  });

  it('accepts a bare array key', () => {
    expect(acceptedTerms({ kind: 'short-answer', choices: [], answer: ['x'] })).toEqual(['x']);
  });

  it('is empty for kinds that do not use accepted terms', () => {
    expect(acceptedTerms({ kind: 'mcq', choices: ['a'], answer: 0 })).toEqual([]);
  });
});
