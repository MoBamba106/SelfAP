'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import {
  clampGoal,
  createPlan,
  deleteAllUserData,
  deleteNote,
  deletePacing,
  deletePlan,
  enroll,
  exportUserData,
  getCourseRollups,
  getProfile,
  isoWeekStartFromUser,
  recordAttempt,
  saveNote,
  savePacing,
  setWeeklyGoal,
  unenroll,
  updateProfile,
  type Note,
  type Pacing,
  type StudyPlan,
} from '@/lib/data/repository';
import { COURSE_BY_ID, QUESTION_BY_ID, getCourse } from '@/content';
import { gradeAnswer } from '@/lib/practice/grading';

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}

/* ------------------------------------------------------------- courses */

export async function joinCourse(slug: string, weeklyGoalMinutes = 120): Promise<ActionResult> {
  const user = await requireUser();
  if (!getCourse(slug)) return { ok: false, message: 'That course does not exist' };
  await enroll(user.id, slug, clampGoal(weeklyGoalMinutes));
  revalidatePath('/home');
  revalidatePath('/courses');
  return { ok: true };
}

export async function leaveCourse(courseId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!COURSE_BY_ID.has(courseId)) return { ok: false, message: 'That course does not exist' };
  await unenroll(user.id, courseId);
  revalidatePath('/home');
  revalidatePath('/courses');
  return { ok: true };
}

export async function changeWeeklyGoal(
  courseId: string,
  minutes: number,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!COURSE_BY_ID.has(courseId)) return { ok: false, message: 'That course does not exist' };
  const weekStart = await isoWeekStartFromUser(user.id);
  await setWeeklyGoal(user.id, courseId, clampGoal(minutes), weekStart);
  revalidatePath('/home');
  revalidatePath('/settings');
  return { ok: true };
}

/* ------------------------------------------------------------ practice */

const answerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.unknown(),
  timeSpentSeconds: z.number().min(0).max(7200).default(0),
  runId: z.string().uuid().optional().nullable(),
  /** Free-response self-assessment. Ignored for kinds that auto-grade. */
  selfGrade: z.boolean().optional(),
});

export async function submitAnswer(input: unknown): Promise<ActionResult<{ correct: boolean | null }>> {
  const user = await requireUser();
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const question = QUESTION_BY_ID.get(parsed.data.questionId);
  if (!question) return { ok: false, message: 'Question not found' };

  // Auto-grading wins wherever it is reliable; self-assessment is only
  // accepted for kinds we deliberately do not grade (FRQ, self-check).
  const auto = gradeAnswer(question, parsed.data.answer);
  const correct = auto !== null ? auto : (parsed.data.selfGrade ?? null);
  await recordAttempt(user.id, {
    questionId: question.id,
    topicId: question.topicId,
    courseId: question.courseId,
    answer: parsed.data.answer,
    isCorrect: correct,
    timeSpentSeconds: parsed.data.timeSpentSeconds,
    runId: parsed.data.runId ?? null,
  });

  revalidatePath('/progress');
  return { ok: true, data: { correct } };
}

/* --------------------------------------------------------------- notes */

const noteSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Give the note a title').max(160),
  body: z.string().max(20000).default(''),
  checklist: z.array(z.object({ text: z.string().max(300), done: z.boolean() })).max(100).default([]),
  courseId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  topicId: z.string().uuid().optional().nullable(),
  lessonId: z.string().uuid().optional().nullable(),
  pinned: z.boolean().optional(),
});

export async function saveUserNote(input: unknown): Promise<ActionResult<Note>> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const note = await saveNote(user.id, parsed.data);
  revalidatePath('/notes');
  revalidatePath('/home');
  return { ok: true, data: note };
}

export async function removeNote(noteId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(noteId).success) return { ok: false, message: 'Bad note' };
  await deleteNote(user.id, noteId);
  revalidatePath('/notes');
  return { ok: true };
}

/* -------------------------------------------------------------- plans */

const planSchema = z.object({
  courseId: z.string().uuid(),
  unitId: z.string().uuid().optional().nullable(),
  kind: z.enum(['goal', 'weekly']),
  title: z.string().trim().min(1).max(160),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  template: z
    .array(z.object({ day: z.number().int().min(0).max(6), minutes: z.number().int().min(0).max(600) }))
    .max(14)
    .default([]),
});

export async function saveStudyPlan(input: unknown): Promise<ActionResult<StudyPlan>> {
  const user = await requireUser();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const plan = await createPlan(user.id, {
    ...parsed.data,
    unitId: parsed.data.unitId ?? null,
    targetDate: parsed.data.targetDate ?? null,
  });
  revalidatePath('/planner');
  return { ok: true, data: plan };
}

export async function removePlan(planId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(planId).success) return { ok: false, message: 'Bad plan' };
  await deletePlan(user.id, planId);
  revalidatePath('/planner');
  return { ok: true };
}

/* ------------------------------------------------------------- pacing */

const pacingSchema = z.object({
  courseId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a finish date'),
  weeklyMinutes: z.number().int().min(0).max(4200),
  mode: z.enum(['calendar', 'time']),
});

/**
 * Save a course's pacing plan.
 *
 * Only the inputs are stored — the week-by-week schedule is derived at read
 * time from the curriculum, so it stays right when content changes.
 */
export async function savePacingPlan(input: unknown): Promise<ActionResult<Pacing>> {
  const user = await requireUser();
  const parsed = pacingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!COURSE_BY_ID.has(parsed.data.courseId)) {
    return { ok: false, message: 'That course does not exist' };
  }
  if (parsed.data.endDate < parsed.data.startDate) {
    return { ok: false, message: 'The finish date has to be on or after the start date.' };
  }
  const plan = await savePacing(user.id, parsed.data);
  revalidatePath(`/courses`);
  return { ok: true, data: plan };
}

export async function removePacingPlan(courseId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!COURSE_BY_ID.has(courseId)) return { ok: false, message: 'That course does not exist' };
  await deletePacing(user.id, courseId);
  revalidatePath(`/courses`);
  return { ok: true }
}

/* ------------------------------------------------------------ account */

const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter a display name').max(60).optional(),
  timezone: z.string().min(1).max(64).optional(),
  weekStartDay: z.number().int().min(0).max(6).optional(),
  examYear: z.number().int().min(2024).max(2035).nullable().optional(),
});

export async function saveProfile(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  await updateProfile(user.id, parsed.data as never);
  revalidatePath('/settings');
  revalidatePath('/home');
  return { ok: true };
}

export async function buildDataExport(): Promise<ActionResult<Record<string, unknown>>> {
  const user = await requireUser();
  const data = await exportUserData(user.id);
  return { ok: true, data };
}

export async function destroyAccount(confirm: string): Promise<ActionResult> {
  const user = await requireUser();
  if (confirm.trim().toUpperCase() !== 'DELETE') {
    return { ok: false, message: 'Type DELETE to confirm.' };
  }
  await deleteAllUserData(user.id);

  // In demo mode the store is in memory; in production the auth user is
  // removed with the service role, which is never available to the browser.
  const { backendKind } = await import('@/lib/supabase/env');
  if (backendKind() === 'demo') {
    const { resetDemoStore } = await import('@/lib/data/backend-demo');
    resetDemoStore();
    const { cookies } = await import('next/headers');
    const store = await cookies();
    store.delete('selfap_demo');
  } else {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const admin = createSupabaseAdminClient();
    await admin.auth.admin.deleteUser(user.id);
  }

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Your account and all study data have been deleted.' };
}

/** Re-exported so the settings page can show live numbers. */
export async function accountSummary(): Promise<{
  courses: number;
  completion: number;
  accuracy: number | null;
  email: string;
}> {
  const user = await requireUser();
  const rollups = await getCourseRollups(user.id);
  const profile = await getProfile(user.id);
  const completions = [...rollups.values()].map((r) => r.completion);
  const attempts = [...rollups.values()].reduce((s, r) => s + r.practiceTotal, 0);
  const correct = [...rollups.values()].reduce(
    (s, r) => s + (r.accuracy === null ? 0 : Math.round(r.accuracy * r.practiceTotal)),
    0,
  );
  return {
    courses: rollups.size,
    completion: completions.length
      ? Math.round(completions.reduce((a, b) => a + b, 0) / completions.length)
      : 0,
    accuracy: attempts ? correct / attempts : null,
    email: profile?.email ?? user.email,
  };
}
