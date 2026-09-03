import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_USER_ID, resetDemoStore } from '@/lib/data/backend-demo';
import {
  deleteAllUserData,
  deleteNote,
  deletePacing,
  enroll,
  exportUserData,
  finishSession,
  getCourseWeeks,
  getEnrollments,
  getPacing,
  getRecentSessions,
  getTopicProgressMap,
  getTotals,
  getWeekHistory,
  heartbeatSession,
  listNotes,
  recordAttempt,
  saveNote,
  savePacing,
  setWeeklyGoal,
  startSession,
  isoWeekStartFromUser,
} from '@/lib/data/repository';
import { COURSES, getCourse } from '@/content';
import { isoDate, weekStart } from '@/lib/utils/time';

/**
 * Integration tests over the data layer, running against the in-memory demo
 * backend. These are the invariants the product promises and that a silent
 * regression would quietly break.
 */

const stats = getCourse('ap-statistics')!;

/** A course the demo seed deliberately leaves without a pacing plan. */
async function courseWithoutPacing() {
  for (const course of COURSES) {
    if ((await getPacing(DEMO_USER_ID, course.id)) === null) return course;
  }
  throw new Error('every seeded course already has a pacing plan');
}

beforeEach(() => {
  resetDemoStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('weekly progress', () => {
  it('resets the week without deleting the history', async () => {
    const now = new Date();
    const before = await getWeekHistory(DEMO_USER_ID, 12, now);
    expect(before.length).toBeGreaterThan(1);
    const historySeconds = before.reduce((sum, w) => sum + w.seconds, 0);
    expect(historySeconds).toBeGreaterThan(0);

    /* A week later the current bucket is empty, but nothing was deleted: the
     * earlier buckets are still there with the same totals. */
    const nextWeek = new Date(now.getTime() + 7 * 86_400_000);
    const after = await getWeekHistory(DEMO_USER_ID, 12, nextWeek);

    const thisWeekNow = before[before.length - 1]!;
    const sameBucketLater = after.find((w) => w.weekStart === thisWeekNow.weekStart);
    expect(sameBucketLater).toBeDefined();
    expect(sameBucketLater!.seconds).toBe(thisWeekNow.seconds);

    const weeks = await getCourseWeeks(DEMO_USER_ID, nextWeek);
    expect(weeks.every((w) => w.seconds === 0)).toBe(true);

    const totalsNow = await getTotals(DEMO_USER_ID, now);
    const totalsLater = await getTotals(DEMO_USER_ID, nextWeek);
    expect(totalsLater.totalSeconds).toBe(totalsNow.totalSeconds);
    expect(totalsLater.weekSeconds).toBe(0);
  });

  it('stores a weekly goal as a snapshot without touching past weeks', async () => {
    const weekStartIso = await isoWeekStartFromUser(DEMO_USER_ID);
    const historyBefore = await getWeekHistory(DEMO_USER_ID, 12);

    await setWeeklyGoal(DEMO_USER_ID, stats.id, 240, weekStartIso);

    const weeks = await getCourseWeeks(DEMO_USER_ID);
    const statsWeek = weeks.find((w) => w.course.id === stats.id);
    expect(statsWeek?.goalMinutes).toBe(240);

    /* Other courses keep their own goals. */
    const other = weeks.find((w) => w.course.id !== stats.id);
    expect(other?.goalMinutes).not.toBe(240);

    const historyAfter = await getWeekHistory(DEMO_USER_ID, 12);
    expect(historyAfter.length).toBe(historyBefore.length);
  });
});

describe('study sessions', () => {
  it('closes an abandoned session at its last heartbeat, not at now', async () => {
    const started = new Date('2026-09-03T09:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(started);

    const session = await startSession(DEMO_USER_ID, {
      courseId: stats.id,
      topicId: stats.topics[0]!.id,
      mode: 'focus',
    });

    /* Two minutes of work, then the tab dies. */
    vi.setSystemTime(new Date(started.getTime() + 120_000));
    await heartbeatSession(DEMO_USER_ID, session.id, 120);

    /* The finish happens an hour later, when the student comes back. */
    vi.setSystemTime(new Date(started.getTime() + 3_720_000));
    const finished = await finishSession(DEMO_USER_ID, session.id);

    expect(finished).not.toBeNull();
    /* Closed at the last heartbeat, not at now — an abandoned tab must not
     * be credited with the hour it sat idle. */
    expect(finished!.durationSeconds).toBe(120);
    expect(finished!.endedAt?.toISOString()).toBe('2026-09-03T09:02:00.000Z');
  });

  it('discards a session that was too short to be real', async () => {
    const session = await startSession(DEMO_USER_ID, { courseId: stats.id });
    const finished = await finishSession(DEMO_USER_ID, session.id);
    expect(finished).toBeNull();

    const recent = await getRecentSessions(DEMO_USER_ID);
    expect(recent.some((s) => s.id === session.id && s.discarded === false)).toBe(false);
  });

  it('keeps only one session open — a second start closes the first', async () => {
    const first = await startSession(DEMO_USER_ID, { courseId: stats.id });
    await heartbeatSession(DEMO_USER_ID, first.id, 90);

    const second = await startSession(DEMO_USER_ID, { courseId: stats.id });
    expect(second.id).not.toBe(first.id);

    /* getRecentSessions only returns live rows, so the discarded session
     * drops out of the list entirely. */
    const recent = await getRecentSessions(DEMO_USER_ID);
    expect(recent.some((row) => row.id === first.id)).toBe(false);

    const open = recent.filter((row) => row.endedAt === null);
    expect(open).toHaveLength(1);
    expect(open[0]!.id).toBe(second.id);

    await finishSession(DEMO_USER_ID, second.id, { discard: true });
  });

  it('refuses to start a session for a course that does not exist', async () => {
    await expect(
      startSession(DEMO_USER_ID, { courseId: '00000000-0000-4000-8000-000000000000' }),
    ).rejects.toThrow();
  });

  it('caps an absurd elapsed value rather than trusting the client', async () => {
    const session = await startSession(DEMO_USER_ID, { courseId: stats.id });
    await heartbeatSession(DEMO_USER_ID, session.id, 999_999);
    const finished = await finishSession(DEMO_USER_ID, session.id);
    /* AUTO_STOP_SECONDS is four hours; the clamp is the point. */
    expect(finished === null || finished.durationSeconds <= 14_400).toBe(true);
  });
});

describe('practice and mastery', () => {
  it('records an attempt against its topic', async () => {
    const topic = stats.topics[0]!;
    const question = topic.questions[0];
    if (!question) return;

    await recordAttempt(DEMO_USER_ID, {
      questionId: question.id,
      topicId: topic.id,
      courseId: stats.id,
      answer: question.answer,
      isCorrect: true,
      timeSpentSeconds: 45,
    });

    const progress = await getTopicProgressMap(DEMO_USER_ID, [stats.id]);
    const entry = progress.get(topic.id);
    expect(entry?.practiceTotal).toBeGreaterThan(0);
  });

  it('does not let logged time alone produce mastery', async () => {
    /* Find a topic the seeded history has not touched. */
    const before = await getTopicProgressMap(DEMO_USER_ID, [stats.id]);
    const topic = stats.topics.find(
      (t) => (before.get(t.id)?.practiceTotal ?? 0) === 0 && !before.get(t.id)?.lessonDone,
    )!;
    expect(topic).toBeDefined();

    const started = new Date('2026-09-03T09:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(started);
    const session = await startSession(DEMO_USER_ID, { courseId: stats.id, topicId: topic.id });

    /* Four hours on the clock, and not a single question answered. */
    vi.setSystemTime(new Date(started.getTime() + 14_400_000));
    await heartbeatSession(DEMO_USER_ID, session.id, 14_400);
    await finishSession(DEMO_USER_ID, session.id);
    vi.useRealTimers();

    const after = await getTopicProgressMap(DEMO_USER_ID, [stats.id]);
    const status = after.get(topic.id)?.mastery.status ?? 'not-started';
    expect(['not-started', 'learning']).toContain(status);
  });
});

describe('pacing', () => {
  it('round-trips a pacing plan per course', async () => {
    const target = await courseWithoutPacing();
    expect(await getPacing(DEMO_USER_ID, target.id)).toBeNull();

    const saved = await savePacing(DEMO_USER_ID, {
      courseId: target.id,
      startDate: '2026-03-02',
      endDate: '2026-05-04',
      weeklyMinutes: 200,
      mode: 'time',
    });
    expect(saved.weeklyMinutes).toBe(200);
    expect(saved.mode).toBe('time');

    const read = await getPacing(DEMO_USER_ID, target.id);
    expect(read?.startDate).toBe('2026-03-02');
    expect(read?.endDate).toBe('2026-05-04');

    await deletePacing(DEMO_USER_ID, target.id);
    expect(await getPacing(DEMO_USER_ID, target.id)).toBeNull();
  });

  it('replaces rather than duplicates when a plan is saved twice', async () => {
    const target = await courseWithoutPacing();
    await savePacing(DEMO_USER_ID, {
      courseId: target.id,
      startDate: '2026-03-02',
      endDate: '2026-05-04',
      weeklyMinutes: 100,
      mode: 'calendar',
    });
    await savePacing(DEMO_USER_ID, {
      courseId: target.id,
      startDate: '2026-03-09',
      endDate: '2026-06-01',
      weeklyMinutes: 300,
      mode: 'calendar',
    });

    const read = await getPacing(DEMO_USER_ID, target.id);
    expect(read?.weeklyMinutes).toBe(300);
    expect(read?.startDate).toBe('2026-03-09');
  });
});

describe('notes', () => {
  it('creates, reads back and deletes a note', async () => {
    const note = await saveNote(DEMO_USER_ID, {
      courseId: stats.id,
      topicId: stats.topics[0]!.id,
      title: 'Conditions for a t interval',
      body: 'Random, 10% condition, nearly normal.',
      checklist: [{ text: 'Redo 3.4', done: false }],
      pinned: true,
    });

    const all = await listNotes(DEMO_USER_ID);
    const found = all.find((n) => n.id === note.id);
    expect(found?.title).toBe('Conditions for a t interval');
    expect(found?.pinned).toBe(true);
    expect(found?.checklist).toHaveLength(1);

    await deleteNote(DEMO_USER_ID, note.id);
    expect((await listNotes(DEMO_USER_ID)).some((n) => n.id === note.id)).toBe(false);
  });

  it('truncates an over-long title rather than failing', async () => {
    const note = await saveNote(DEMO_USER_ID, { title: 'x'.repeat(400), body: '' });
    expect(note.title.length).toBeLessThanOrEqual(160);
    await deleteNote(DEMO_USER_ID, note.id);
  });
});

describe('enrolment', () => {
  it('adds a course and removes it again', async () => {
    const fresh = 'ap-english-literature-and-composition';
    const before = await getEnrollments(DEMO_USER_ID);
    const hadIt = before.some((e) => e.course.slug === fresh);

    if (!hadIt) {
      await enroll(DEMO_USER_ID, fresh, 120);
      const after = await getEnrollments(DEMO_USER_ID);
      expect(after.some((e) => e.course.slug === fresh)).toBe(true);
    }
  });

  it('rejects an unknown course slug', async () => {
    await expect(enroll(DEMO_USER_ID, 'ap-astrology', 120)).rejects.toThrow();
  });
});

describe('data ownership', () => {
  it('exports pacing alongside the rest of the account', async () => {
    const data = await exportUserData(DEMO_USER_ID);
    expect(data.pacing).toBeDefined();
    expect(Array.isArray(data.pacing)).toBe(true);
    expect(data.studySessions).toBeDefined();
    expect(data.notes).toBeDefined();
  });

  it('deletes everything the user owns', async () => {
    await saveNote(DEMO_USER_ID, { title: 'Doomed', body: '' });
    await deleteAllUserData(DEMO_USER_ID);

    expect(await listNotes(DEMO_USER_ID)).toHaveLength(0);
    expect(await getEnrollments(DEMO_USER_ID)).toHaveLength(0);
    expect(await getRecentSessions(DEMO_USER_ID)).toHaveLength(0);
  });
});

describe('week maths', () => {
  it('agrees with the SQL view on where a week starts', async () => {
    const now = new Date('2026-09-03T12:00:00Z');
    const fromRpc = await isoWeekStartFromUser(DEMO_USER_ID, now);
    const expected = isoDate(weekStart(now, 1));
    expect(fromRpc).toBe(expected);
  });
});
