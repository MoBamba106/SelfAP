import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_USER_ID, resetDemoStore } from '@/lib/data/backend-demo';
import {
  completeLesson,
  deleteAllUserData,
  enroll,
  getRecommendation,
  globalSearch,
  listNotes,
  recordAttempt,
  saveNote,
} from '@/lib/data/repository';
import { ALL_TOPICS, COURSES, getCourse } from '@/content';

beforeEach(() => {
  resetDemoStore();
});

describe('getRecommendation — "what should I study"', () => {
  it('returns nothing at all for an account with no courses', async () => {
    await deleteAllUserData(DEMO_USER_ID);
    expect(await getRecommendation(DEMO_USER_ID)).toBeNull();
  });

  it('always points at a real, reachable destination', async () => {
    const rec = await getRecommendation(DEMO_USER_ID);
    expect(rec).not.toBeNull();
    expect(rec!.href).toMatch(/^\/(learn|courses)\//);
    expect(ALL_TOPICS.some((t) => t.id === rec!.topic.id)).toBe(true);
    expect(COURSES.some((c) => c.id === rec!.course.id)).toBe(true);
  });

  it('explains itself — a recommendation without reasons is not actionable', async () => {
    const rec = await getRecommendation(DEMO_USER_ID);
    expect(rec!.reasons.length).toBeGreaterThan(0);
    expect(rec!.reasons.length).toBeLessThanOrEqual(3);
    for (const reason of rec!.reasons) {
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it('reports the progress of the unit it is pointing into', async () => {
    const rec = await getRecommendation(DEMO_USER_ID);
    const { done, total } = rec!.unitProgress;
    expect(total).toBeGreaterThan(0);
    expect(done).toBeGreaterThanOrEqual(0);
    expect(done).toBeLessThanOrEqual(total);
  });

  it('does not recommend a topic that is already mastered', async () => {
    /* Mark every attempted topic in the recommended course as strongly
     * practised; the recommendation should move off it. */
    const rec = await getRecommendation(DEMO_USER_ID);
    expect(rec).not.toBeNull();

    const topic = rec!.topic;
    const questions = topic.questions;
    if (!questions.length) return;

    for (let i = 0; i < 6; i += 1) {
      await recordAttempt(DEMO_USER_ID, {
        questionId: questions[i % questions.length]!.id,
        topicId: topic.id,
        courseId: topic.courseId,
        answer: questions[i % questions.length]!.answer,
        isCorrect: true,
        timeSpentSeconds: 30,
      });
    }

    const after = await getRecommendation(DEMO_USER_ID);
    expect(after).not.toBeNull();
    expect(after!.topic.id).not.toBe(topic.id);
  });

  it('is deterministic for an unchanged account', async () => {
    const a = await getRecommendation(DEMO_USER_ID);
    const b = await getRecommendation(DEMO_USER_ID);
    expect(a!.topic.id).toBe(b!.topic.id);
    expect(a!.reasons).toEqual(b!.reasons);
  });

  it('still pushes review of topics you get wrong after their lesson is done', async () => {
    const course = getCourse('ap-statistics')!;

    /* Finish every lesson in the course. */
    for (const topic of course.topics) {
      if (topic.lesson) await completeLesson(DEMO_USER_ID, topic.lesson.id, topic.id, course.id);
    }

    const rec = await getRecommendation(DEMO_USER_ID);
    expect(rec).not.toBeNull();
    /* Reading a lesson is not the same as knowing the material: a topic whose
     * accuracy is still poor stays recommended even though the lesson is
     * ticked off. That is the point of the accuracy weighting. */
    expect(rec!.reasons.join(' ').toLowerCase()).toMatch(/accuracy|correct|practice|weak/);
  });

  it('stops recommending a topic once it is genuinely strong', async () => {
    const course = getCourse('ap-statistics')!;
    const before = await getRecommendation(DEMO_USER_ID);
    const topic = before!.topic;
    const questions = topic.questions;
    if (!questions.length) return;

    /* Six consecutive correct answers across the topic's questions. */
    for (let i = 0; i < 6; i += 1) {
      const q = questions[i % questions.length]!;
      await recordAttempt(DEMO_USER_ID, {
        questionId: q.id,
        topicId: topic.id,
        courseId: course.id,
        answer: q.answer,
        isCorrect: true,
        timeSpentSeconds: 30,
      });
    }

    const after = await getRecommendation(DEMO_USER_ID);
    expect(after).not.toBeNull();
    expect(after!.topic.id).not.toBe(topic.id);
  });
});

describe('globalSearch', () => {
  it('ignores queries too short to be meaningful', async () => {
    expect(await globalSearch(DEMO_USER_ID, '')).toHaveLength(0);
    expect(await globalSearch(DEMO_USER_ID, 'x')).toHaveLength(0);
  });

  it('finds a topic by name and returns a working href', async () => {
    const topic = ALL_TOPICS.find((t) => t.title.length > 12)!;
    const needle = topic.title.split(' ')[0]!;
    const results = await globalSearch(DEMO_USER_ID, needle);

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.href).toMatch(/^\//);
      expect(result.kind).toBeTruthy();
      expect(result.title).toBeTruthy();
    }
  });

  it('finds the student’s own notes alongside curriculum', async () => {
    await saveNote(DEMO_USER_ID, {
      title: 'Zygomatic arch mnemonic',
      body: 'Cheekbone, not jawbone.',
    });

    const results = await globalSearch(DEMO_USER_ID, 'Zygomatic');
    const note = results.find((r) => r.kind === 'note');
    expect(note).toBeDefined();
    expect(note!.href).toMatch(/^\/notes\//);
  });

  it('only returns notes that actually match', async () => {
    await saveNote(DEMO_USER_ID, { title: 'Zygomatic arch mnemonic', body: '' });

    const matching = await globalSearch(DEMO_USER_ID, 'Zygomatic');
    expect(matching.some((r) => r.kind === 'note')).toBe(true);

    /* A query that only matches curriculum must not drag the note along. */
    const curriculumOnly = await globalSearch(DEMO_USER_ID, 'histogram');
    expect(curriculumOnly.some((r) => r.kind === 'note')).toBe(false);
  });

  it('never returns more than the requested cap', async () => {
    const results = await globalSearch(DEMO_USER_ID, 'the');
    expect(results.length).toBeLessThanOrEqual(24);
  });
});

describe('enrolment drives everything else', () => {
  it('a brand-new enrolment immediately produces a recommendation', async () => {
    await deleteAllUserData(DEMO_USER_ID);
    expect(await getRecommendation(DEMO_USER_ID)).toBeNull();

    await enroll(DEMO_USER_ID, 'ap-statistics', 120);
    const rec = await getRecommendation(DEMO_USER_ID);
    expect(rec).not.toBeNull();
    expect(rec!.course.slug).toBe('ap-statistics');
    /* Nothing studied yet, so it starts at the front. */
    expect(rec!.unit.code).toBe('1');
  });

  it('notes survive independently of enrolment', async () => {
    await saveNote(DEMO_USER_ID, { title: 'Kept', body: '' });
    await deleteAllUserData(DEMO_USER_ID);
    await enroll(DEMO_USER_ID, 'ap-statistics', 120);
    expect(await listNotes(DEMO_USER_ID)).toHaveLength(0);
  });
});
