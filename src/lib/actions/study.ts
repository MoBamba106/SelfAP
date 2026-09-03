'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import {
  AUTO_STOP_SECONDS,
  completeLesson,
  finishSession,
  heartbeatSession,
  saveVideoPosition,
  setSelfRating,
  startSession,
  type SessionRow,
} from '@/lib/data/repository';
import { getTopic } from '@/content';

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}

const startSchema = z.object({
  courseId: z.string().uuid('Choose a course'),
  unitId: z.string().uuid().optional().nullable(),
  topicId: z.string().uuid().optional().nullable(),
  lessonId: z.string().uuid().optional().nullable(),
  mode: z.enum(['focus', 'lesson', 'practice', 'review']).optional(),
});

export async function startStudySession(input: unknown): Promise<ActionResult<SessionRow>> {
  const user = await requireUser();
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const session = await startSession(user.id, parsed.data);
  revalidatePath('/home');
  return { ok: true, data: session };
}

export async function pingStudySession(
  sessionId: string,
  elapsedSeconds: number,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(sessionId).success) return { ok: false, message: 'Bad session' };

  const elapsed = Math.min(Math.max(0, Number(elapsedSeconds) || 0), AUTO_STOP_SECONDS);
  await heartbeatSession(user.id, sessionId, elapsed);
  return { ok: true };
}

export async function stopStudySession(
  sessionId: string,
  options: { notes?: string; discard?: boolean } = {},
): Promise<ActionResult<{ seconds: number }>> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(sessionId).success) return { ok: false, message: 'Bad session' };

  const notes = typeof options.notes === 'string' ? options.notes.slice(0, 4000) : undefined;
  const session = await finishSession(user.id, sessionId, { notes, discard: options.discard });

  revalidatePath('/home');
  revalidatePath('/progress');
  if (!session) return { ok: true, data: { seconds: 0 }, message: 'Session discarded' };
  return { ok: true, data: { seconds: session.durationSeconds } };
}

export async function markLessonComplete(lessonId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(lessonId).success) return { ok: false, message: 'Bad lesson' };

  const { LESSON_BY_ID } = await import('@/content');
  const lesson = LESSON_BY_ID.get(lessonId);
  if (!lesson) return { ok: false, message: 'Lesson not found' };

  await completeLesson(user.id, lesson.id, lesson.courseId, lesson.topicId);
  revalidatePath('/home');
  revalidatePath('/progress');
  return { ok: true };
}

export async function storeVideoPosition(
  lessonId: string,
  seconds: number,
): Promise<ActionResult> {
  const user = await requireUser();
  const { LESSON_BY_ID } = await import('@/content');
  const lesson = LESSON_BY_ID.get(lessonId);
  if (!lesson) return { ok: false, message: 'Lesson not found' };

  await saveVideoPosition(user.id, lesson.id, lesson.courseId, lesson.topicId, Number(seconds) || 0);
  return { ok: true };
}

export async function rateTopicConfidence(
  topicId: string,
  rating: number | null,
): Promise<ActionResult> {
  const user = await requireUser();
  const topic = getTopic(topicId);
  if (!topic) return { ok: false, message: 'Topic not found' };

  const value = rating === null ? null : Math.min(5, Math.max(1, Math.round(rating)));
  await setSelfRating(user.id, topic.id, topic.courseId, value);
  revalidatePath('/progress');
  return { ok: true };
}
