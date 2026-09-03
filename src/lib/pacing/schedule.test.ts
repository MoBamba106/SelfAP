import { describe, expect, it } from 'vitest';
import { buildSchedule, estimateTopic } from './schedule';
import type { Course, Topic } from '@/content';

/* A small synthetic course: two units, six topics, mixed lesson lengths. */
function makeTopic(code: string, minutes: number, questions: number): Topic {
  return {
    id: `topic-${code}`,
    unitId: code.startsWith('1') ? 'unit-1' : 'unit-2',
    courseId: 'course-1',
    code,
    title: `Topic ${code}`,
    summary: '',
    keyIdeas: [],
    position: Number(code.split('.')[1]) - 1,
    lesson: {
      id: `lesson-${code}`,
      topicId: `topic-${code}`,
      courseId: 'course-1',
      title: `Topic ${code}`,
      summary: '',
      objectives: [],
      body: [],
      vocabulary: [],
      formulas: [],
      mistakes: [],
      review: [],
      videos: [],
      minutes,
      draft: false,
      position: 0,
    } as Topic['lesson'],
    questions: Array.from({ length: questions }, (_, i) => ({ id: `q-${code}-${i}` })) as Topic['questions'],
  };
}

const TOPICS = [
  makeTopic('1.1', 10, 2),
  makeTopic('1.2', 12, 3),
  makeTopic('1.3', 8, 1),
  makeTopic('2.1', 15, 4),
  makeTopic('2.2', 20, 2),
  makeTopic('2.3', 9, 1),
];

const COURSE = {
  id: 'course-1',
  slug: 'test-course',
  code: 'AP Test',
  shortName: 'Test',
  topics: TOPICS,
  topicCount: TOPICS.length,
  units: [
    { id: 'unit-1', code: '1', topics: TOPICS.slice(0, 3) },
    { id: 'unit-2', code: '2', topics: TOPICS.slice(3) },
  ],
} as unknown as Course;

const inputs = (over: Partial<Parameters<typeof buildSchedule>[1]> = {}) => ({
  startDate: new Date('2026-03-02T12:00:00Z'), // a Monday
  endDate: new Date('2026-03-30T12:00:00Z'), // four weeks later
  weeklyMinutes: 150,
  mode: 'calendar' as const,
  weekStartDay: 1,
  today: new Date('2026-03-02T12:00:00Z'),
  ...over,
});

describe('estimateTopic', () => {
  it('adds practice time and an overhead allowance to the lesson length', () => {
    // 10 min lesson + 2 questions * 3 min = 16, plus 15% = 18.4 -> 18
    expect(estimateTopic(TOPICS[0]!)).toBe(18);
  });

  it('still budgets time for a topic with no authored lesson', () => {
    const bare = { ...TOPICS[0]!, lesson: null } as unknown as Topic;
    expect(estimateTopic(bare)).toBeGreaterThan(0);
  });
});

describe('buildSchedule', () => {
  it('covers every topic exactly once', () => {
    const schedule = buildSchedule(COURSE, inputs(), new Set());
    const seen = schedule.weeks.flatMap((w) => w.topics.map((t) => t.topic.id));
    expect(seen).toHaveLength(TOPICS.length);
    expect(new Set(seen).size).toBe(TOPICS.length);
  });

  it('is deterministic — the same inputs give the same plan', () => {
    const a = buildSchedule(COURSE, inputs(), new Set());
    const b = buildSchedule(COURSE, inputs(), new Set());
    expect(a.weeks.map((w) => w.topics.map((t) => t.topic.code))).toEqual(
      b.weeks.map((w) => w.topics.map((t) => t.topic.code)),
    );
  });

  it('spreads the load evenly in calendar mode', () => {
    const schedule = buildSchedule(COURSE, inputs(), new Set());
    const loads = schedule.weeks.map((w) => w.estimatedMinutes);
    expect(loads.length).toBeGreaterThan(1);
    // Balanced allocation should not leave one week doing several times another.
    expect(Math.max(...loads)).toBeLessThanOrEqual(Math.min(...loads) * 2.5);
  });

  it('packs to the weekly budget in time mode', () => {
    const schedule = buildSchedule(COURSE, inputs({ mode: 'time', weeklyMinutes: 40 }), new Set());
    // Every week but the last should sit at or just over the budget — never
    // wildly past it, since a topic is not split across weeks.
    const biggest = Math.max(...schedule.weeks.map((w) => w.estimatedMinutes));
    expect(biggest).toBeLessThanOrEqual(40 + Math.max(...TOPICS.map(estimateTopic)));
  });

  it('marks the week containing today as current', () => {
    const schedule = buildSchedule(
      COURSE,
      inputs({ today: new Date('2026-03-11T12:00:00Z') }),
      new Set(),
    );
    const current = schedule.weeks.filter((w) => w.status === 'current');
    expect(current).toHaveLength(1);
    expect(schedule.currentWeekIndex).toBe(schedule.weeks.indexOf(current[0]!));
  });

  it('counts topics that should already be done but are not', () => {
    const laterToday = new Date('2026-03-25T12:00:00Z');
    const behind = buildSchedule(COURSE, inputs({ today: laterToday }), new Set());
    expect(behind.behindBy).toBeGreaterThan(0);

    const allDone = new Set(TOPICS.map((t) => t.id));
    const caught = buildSchedule(COURSE, inputs({ today: laterToday }), allDone);
    expect(caught.behindBy).toBe(0);
    expect(caught.percentComplete).toBe(100);
  });

  it('reports percent complete by estimated work, not topic count', () => {
    const heavy = TOPICS.reduce(
      (max, t) => (estimateTopic(t) > estimateTopic(max) ? t : max),
      TOPICS[0]!,
    );
    const schedule = buildSchedule(COURSE, inputs(), new Set([heavy.id]));
    const expected = Math.round(
      (estimateTopic(heavy) / TOPICS.reduce((s, t) => s + estimateTopic(t), 0)) * 100,
    );
    expect(schedule.percentComplete).toBe(expected);
  });

  it('flags a plan that asks for more than the weekly budget allows', () => {
    const infeasible = buildSchedule(COURSE, inputs({ weeklyMinutes: 5 }), new Set());
    expect(infeasible.feasible).toBe(false);
    expect(infeasible.reason.length).toBeGreaterThan(0);
  });

  it('projects a finish date in time mode', () => {
    const schedule = buildSchedule(COURSE, inputs({ mode: 'time', weeklyMinutes: 30 }), new Set());
    expect(schedule.projectedFinish).toBeInstanceOf(Date);
  });

  it('handles an empty curriculum without dividing by zero', () => {
    const empty = { ...COURSE, topics: [], topicCount: 0 } as unknown as Course;
    const schedule = buildSchedule(empty, inputs(), new Set());
    expect(schedule.weeks).toHaveLength(0);
    expect(schedule.percentComplete).toBe(0);
    expect(schedule.totalMinutes).toBe(0);
  });

  it('collapses to a single week when start and end are the same day', () => {
    const sameDay = new Date('2026-03-02T12:00:00Z');
    const schedule = buildSchedule(
      COURSE,
      inputs({ startDate: sameDay, endDate: sameDay }),
      new Set(),
    );
    expect(schedule.weeks.length).toBeGreaterThanOrEqual(1);
    expect(schedule.weeks.flatMap((w) => w.topics)).toHaveLength(TOPICS.length);
  });
});
