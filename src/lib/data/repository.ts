import 'server-only';
import {
  COURSE_BY_ID,
  getCourse,
  getTopic,
  getUnit,
  type Course,
  type Topic,
} from '@/content';
import { computeMastery, type MasteryResult, type MasteryStatus } from '@/lib/utils/mastery';
import { DAY_MS, addDays, isoDate, weekStart } from '@/lib/utils/time';
import { db, firstRow, unwrap, unwrapOne, type Row } from './index';

/* ------------------------------------------------------------------ *
 * Repository. Every read and write the app performs, in one place.
 *
 * Ownership is never checked here. Each query is scoped by user_id, and
 * Row Level Security enforces that the only rows a session can see or
 * touch are its own. That is the difference between a filter and a
 * control: a forgotten `.eq('user_id', …)` would leak nothing, because
 * Postgres would already have filtered it out.
 * ------------------------------------------------------------------ */

/** Longest a single session may be. The timer auto-stops at AUTO_STOP. */
export const AUTO_STOP_SECONDS = 4 * 3600;
export const HARD_CAP_SECONDS = 8 * 3600;
/** How often the running timer reports progress. */
export const HEARTBEAT_SECONDS = 30;

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  weekStartDay: number;
  examYear: number | null;
  preferences: Record<string, unknown>;
  role: 'student' | 'admin';
}

export interface Enrollment {
  courseId: string;
  course: Course;
  weeklyGoalMinutes: number;
  position: number;
  enrolledAt: string;
}

export type GoalState = 'not-started' | 'in-progress' | 'reached' | 'exceeded';

export interface CourseWeek {
  course: Course;
  seconds: number;
  goalMinutes: number;
  percent: number;
  state: GoalState;
}

export interface SessionRow {
  id: string;
  courseId: string;
  unitId: string | null;
  topicId: string | null;
  lessonId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  heartbeatAt: Date | null;
  durationSeconds: number;
  mode: string;
  notes: string;
  discarded: boolean;
}

export interface TopicProgress {
  topicId: string;
  courseId: string;
  lessonDone: boolean;
  lessonDoneAt: string | null;
  practiceCorrect: number;
  practiceTotal: number;
  recentCorrect: number;
  recentTotal: number;
  selfRating: number | null;
  lastReviewedAt: string | null;
  mastery: MasteryResult;
}

export interface ActivityItem {
  id: string;
  kind: 'lesson' | 'practice' | 'session';
  title: string;
  subtitle: string;
  at: string;
  accent: string;
}

export interface SearchResult {
  kind: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/* ------------------------------------------------------------------ *
 * profiles
 * ------------------------------------------------------------------ */

export async function getProfile(userId: string): Promise<Profile | null> {
  const backend = await db();
  const row = unwrapOne(
    await backend.from('profiles').select('*').eq('id', userId).maybeSingle(),
  ) as Row | null;
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email ?? ''),
    displayName: String(row.display_name ?? ''),
    timezone: String(row.timezone ?? 'UTC'),
    weekStartDay: Number(row.week_start_day ?? 1),
    examYear: row.exam_year == null ? null : Number(row.exam_year),
    preferences: (row.preferences as Record<string, unknown>) ?? {},
    role: row.role === 'admin' ? 'admin' : 'student',
  };
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'displayName' | 'timezone' | 'weekStartDay' | 'examYear'>>,
): Promise<void> {
  const backend = await db();
  const values: Row = { updated_at: new Date().toISOString() };
  if (patch.displayName !== undefined) values.display_name = patch.displayName.slice(0, 80);
  if (patch.timezone !== undefined) values.timezone = patch.timezone.slice(0, 64);
  if (patch.weekStartDay !== undefined) values.week_start_day = patch.weekStartDay;
  if (patch.examYear !== undefined) values.exam_year = patch.examYear;
  unwrap(await backend.from('profiles').update(values).eq('id', userId).select());
}

export async function mergePreferences(
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) return;
  const backend = await db();
  unwrap(
    await backend
      .from('profiles')
      .update({
        preferences: { ...profile.preferences, ...patch },
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select(),
  );
}

/* ------------------------------------------------------------------ *
 * enrolment
 * ------------------------------------------------------------------ */

export async function getEnrollments(userId: string): Promise<Enrollment[]> {
  const backend = await db();
  const rows = unwrap(
    await backend.from('user_courses').select('*').eq('user_id', userId).eq('active', true),
  );
  const out: Enrollment[] = [];
  for (const row of rows) {
    const course = COURSE_BY_ID.get(String(row.course_id));
    if (!course) continue;
    out.push({
      courseId: course.id,
      course,
      weeklyGoalMinutes: Number(row.default_weekly_minutes ?? 120),
      position: Number(row.position ?? 0),
      enrolledAt: String(row.enrolled_at ?? new Date().toISOString()),
    });
  }
  return out.sort((a, b) => a.position - b.position);
}

export async function enroll(userId: string, courseSlug: string, weeklyGoalMinutes = 120): Promise<void> {
  const course = getCourse(courseSlug);
  if (!course) throw new Error(`Unknown course: ${courseSlug}`);
  const backend = await db();
  const existing = unwrap(await backend.from('user_courses').select('*').eq('user_id', userId));
  const position = existing.length;
  unwrap(
    await backend.from('user_courses').upsert(
      {
        user_id: userId,
        course_id: course.id,
        default_weekly_minutes: clampGoal(weeklyGoalMinutes),
        active: true,
        position,
      },
      { onConflict: 'user_id,course_id' },
    ),
  );
}

export async function unenroll(userId: string, courseId: string): Promise<void> {
  const backend = await db();
  unwrap(await backend.from('user_courses').update({ active: false }).eq('user_id', userId).eq('course_id', courseId).select());
}

export async function setWeeklyGoal(
  userId: string,
  courseId: string,
  minutes: number,
  weekStartIso: string,
): Promise<void> {
  const value = clampGoal(minutes);
  const backend = await db();
  // The default applies to every future week; the snapshot keeps the
  // current week's history honest if the goal changes mid-week.
  unwrap(
    await backend
      .from('user_courses')
      .update({ default_weekly_minutes: value })
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .select(),
  );
  unwrap(
    await backend.from('weekly_goals').upsert(
      { user_id: userId, course_id: courseId, week_start: weekStartIso, minutes: value },
      { onConflict: 'user_id,course_id,week_start' },
    ),
  );
}

/** ISO date of the current study week for this user, in their own timezone. */
export async function isoWeekStartFromUser(userId: string, now = new Date()): Promise<string> {
  const profile = await getProfile(userId);
  const weekStartDay = profile?.weekStartDay ?? 1;
  let base = now;
  const tz = profile?.timezone;
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
      base = new Date(
        Number(get('year')),
        Number(get('month')) - 1,
        Number(get('day')),
        Number(get('hour')),
        Number(get('minute')),
      );
    } catch {
      // Unknown timezone name — fall back to server-local time.
    }
  }
  return isoDate(weekStart(base, weekStartDay));
}

export function clampGoal(minutes: number): number {
  const n = Math.round(Number(minutes));
  if (!Number.isFinite(n)) return 120;
  return Math.min(4200, Math.max(0, n));
}

/* ------------------------------------------------------------------ *
 * weekly progress
 * ------------------------------------------------------------------ */

async function goalForWeek(
  backend: Awaited<ReturnType<typeof db>>,
  userId: string,
  courseIds: string[],
  weekStartIso: string,
  enrollments: Enrollment[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const e of enrollments) map.set(e.courseId, e.weeklyGoalMinutes);
  if (!courseIds.length) return map;

  const rows = unwrap(
    await backend
      .from('weekly_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStartIso)
      .in('course_id', courseIds),
  );
  for (const row of rows) map.set(String(row.course_id), Number(row.minutes ?? 0));
  return map;
}

export async function getCourseWeeks(userId: string, now = new Date()): Promise<CourseWeek[]> {
  const enrollments = await getEnrollments(userId);
  if (!enrollments.length) return [];
  const profile = await getProfile(userId);
  const weekStartDay = profile?.weekStartDay ?? 1;
  const weekStartIso = isoDate(weekStart(now, weekStartDay));
  const since = new Date(`${weekStartIso}T00:00:00`);

  const backend = await db();
  const courseIds = enrollments.map((e) => e.courseId);
  const [sessions, goals] = await Promise.all([
    backend
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('discarded', false)
      .gte('started_at', since.toISOString()),
    goalForWeek(backend, userId, courseIds, weekStartIso, enrollments),
  ]);

  const byCourse = new Map<string, number>();
  for (const s of unwrap(sessions)) {
    const id = String(s.course_id);
    byCourse.set(id, (byCourse.get(id) ?? 0) + Number(s.duration_seconds ?? 0));
  }

  return enrollments.map((e) => {
    const seconds = byCourse.get(e.courseId) ?? 0;
    const goalMinutes = goals.get(e.courseId) ?? e.weeklyGoalMinutes;
    const targetSeconds = goalMinutes * 60;
    const percent = targetSeconds ? Math.min(999, Math.round((seconds / targetSeconds) * 100)) : 0;
    let state: GoalState = 'not-started';
    if (seconds > 0 && targetSeconds && seconds >= targetSeconds * 1.1) state = 'exceeded';
    else if (seconds > 0 && targetSeconds && seconds >= targetSeconds) state = 'reached';
    else if (seconds > 0) state = 'in-progress';
    return { course: e.course, seconds, goalMinutes, percent, state };
  });
}

export interface WeekBucket {
  weekStart: string;
  label: string;
  seconds: number;
  goalMinutes: number;
}

export async function getWeekHistory(
  userId: string,
  weeks = 12,
  now = new Date(),
): Promise<WeekBucket[]> {
  const profile = await getProfile(userId);
  const weekStartDay = profile?.weekStartDay ?? 1;
  const thisWeek = weekStart(now, weekStartDay);
  const from = addDays(thisWeek, -(weeks - 1) * 7);

  const enrollments = await getEnrollments(userId);
  const courseIds = enrollments.map((e) => e.courseId);
  const backend = await db();
  const sessions = unwrap(
    await backend
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('discarded', false)
      .gte('started_at', from.toISOString()),
  );

  const goals = unwrap(
    await backend
      .from('weekly_goals')
      .select('*')
      .eq('user_id', userId)
      .gte('week_start', isoDate(from))
      .lte('week_start', isoDate(thisWeek)),
  );

  const buckets: WeekBucket[] = [];
  const index = new Map<string, WeekBucket>();
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = addDays(thisWeek, -i * 7);
    const key = isoDate(start);
    const goalMinutes = goals
      .filter((g) => String(g.week_start) === key)
      .reduce((sum, g) => sum + Number(g.minutes ?? 0), 0)
      || enrollments.reduce((s, e) => s + e.weeklyGoalMinutes, 0);
    const bucket: WeekBucket = {
      weekStart: key,
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      seconds: 0,
      goalMinutes,
    };
    buckets.push(bucket);
    index.set(key, bucket);
  }

  for (const s of sessions) {
    const d = new Date(String(s.started_at));
    const key = isoDate(weekStart(d, weekStartDay));
    const bucket = index.get(key);
    if (bucket) bucket.seconds += Number(s.duration_seconds ?? 0);
  }

  void courseIds;
  return buckets;
}

/* ------------------------------------------------------------------ *
 * study sessions
 * ------------------------------------------------------------------ */

function mapSession(row: Row): SessionRow {
  return {
    id: String(row.id),
    courseId: String(row.course_id),
    unitId: row.unit_id ? String(row.unit_id) : null,
    topicId: row.topic_id ? String(row.topic_id) : null,
    lessonId: row.lesson_id ? String(row.lesson_id) : null,
    startedAt: new Date(String(row.started_at)),
    endedAt: row.ended_at ? new Date(String(row.ended_at)) : null,
    heartbeatAt: row.heartbeat_at ? new Date(String(row.heartbeat_at)) : null,
    durationSeconds: Number(row.duration_seconds ?? 0),
    mode: String(row.mode ?? 'focus'),
    notes: String(row.notes ?? ''),
    discarded: Boolean(row.discarded),
  };
}

export async function findOpenSession(userId: string): Promise<SessionRow | null> {
  const backend = await db();
  const rows = unwrap(
    await backend
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1),
  );
  return rows.length ? mapSession(rows[0]) : null;
}

export interface StartSessionInput {
  courseId: string;
  unitId?: string | null;
  topicId?: string | null;
  lessonId?: string | null;
  mode?: string;
}

export async function startSession(userId: string, input: StartSessionInput): Promise<SessionRow> {
  const course = COURSE_BY_ID.get(input.courseId);
  if (!course) throw new Error('Unknown course');

  // Only one session can be open at a time — a second start is a bug or a
  // double-click, so close the first one instead of stacking timers.
  const open = await findOpenSession(userId);
  if (open) await finishSession(userId, open.id, { discard: true });

  const now = new Date();
  const backend = await db();
  const rows = unwrap(
    await backend
      .from('study_sessions')
      .insert({
        user_id: userId,
        course_id: input.courseId,
        unit_id: input.unitId ?? null,
        topic_id: input.topicId ?? null,
        lesson_id: input.lessonId ?? null,
        started_at: now.toISOString(),
        ended_at: null,
        heartbeat_at: now.toISOString(),
        duration_seconds: 0,
        mode: input.mode ?? 'focus',
        notes: '',
        discarded: false,
      })
      .select(),
  );
  return mapSession(rows[0]);
}

/**
 * Progress write from the running timer. Moving `heartbeat_at` forward is
 * what makes a crashed tab lose at most one interval: the row already
 * records how far the student actually got.
 */
export async function heartbeatSession(
  userId: string,
  sessionId: string,
  elapsedSeconds: number,
): Promise<void> {
  const capped = Math.min(Math.max(0, Math.round(elapsedSeconds)), HARD_CAP_SECONDS);
  const now = new Date().toISOString();
  const backend = await db();
  unwrap(
    await backend
      .from('study_sessions')
      .update({ heartbeat_at: now, duration_seconds: capped })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select(),
  );
}

export async function finishSession(
  userId: string,
  sessionId: string,
  options?: { notes?: string; discard?: boolean },
): Promise<SessionRow | null> {
  const backend = await db();
  const row = await firstRow(
    backend.from('study_sessions').select('*').eq('id', sessionId).eq('user_id', userId),
  );
  if (!row) return null;

  const started = new Date(String(row.started_at));
  const lastBeat = row.heartbeat_at ? new Date(String(row.heartbeat_at)) : started;
  const now = new Date();

  // A session that stopped heartbeating (closed tab, lost network) is
  // closed at its last heartbeat rather than at now.
  const end = options?.discard ? now : new Date(Math.min(now.getTime(), Math.max(lastBeat.getTime(), started.getTime())));
  const raw = Math.round((end.getTime() - started.getTime()) / 1000);
  const duration = Math.min(Math.max(raw, 0), AUTO_STOP_SECONDS);

  if (options?.discard || duration < 30) {
    unwrap(
      await backend
        .from('study_sessions')
        .update({ ended_at: end.toISOString(), duration_seconds: 0, discarded: true })
        .eq('id', sessionId)
        .eq('user_id', userId)
        .select(),
    );
    return null;
  }

  const updated = unwrap(
    await backend
      .from('study_sessions')
      .update({
        ended_at: end.toISOString(),
        duration_seconds: duration,
        notes: (options?.notes ?? String(row.notes ?? '')).slice(0, 4000),
        discarded: false,
      })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select(),
  );
  return updated[0] ? mapSession(updated[0]) : null;
}

export async function getRecentSessions(userId: string, limit = 40): Promise<SessionRow[]> {
  const backend = await db();
  const rows = unwrap(
    await backend
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('discarded', false)
      .order('started_at', { ascending: false })
      .limit(limit),
  );
  return rows.map(mapSession);
}

export interface Totals {
  totalSeconds: number;
  weekSeconds: number;
  streakDays: number;
  sessions: number;
}

export async function getTotals(userId: string, now = new Date()): Promise<Totals> {
  const profile = await getProfile(userId);
  const weekStartDay = profile?.weekStartDay ?? 1;
  const backend = await db();
  const rows = unwrap(
    await backend
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('discarded', false)
      .gte('started_at', new Date(now.getTime() - DAY_MS * 400).toISOString()),
  );
  const sessions = rows.map(mapSession);
  const totalSeconds = sessions.reduce((s, x) => s + x.durationSeconds, 0);
  const since = weekStart(now, weekStartDay);
  const weekSeconds = sessions
    .filter((s) => s.startedAt >= since)
    .reduce((s, x) => s + x.durationSeconds, 0);

  // Streak: consecutive calendar days with any logged study, counting back
  // from today (or yesterday, so a streak is not broken before dinner).
  const days = new Set(sessions.map((s) => isoDate(s.startedAt)));
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(isoDate(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(isoDate(cursor)) && streak < 400) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return { totalSeconds, weekSeconds, streakDays: streak, sessions: sessions.length };
}

/* ------------------------------------------------------------------ *
 * topic + lesson progress
 * ------------------------------------------------------------------ */

export async function getTopicProgressMap(
  userId: string,
  courseIds: string[],
): Promise<Map<string, TopicProgress>> {
  const map = new Map<string, TopicProgress>();
  if (!courseIds.length) return map;
  const backend = await db();
  const rows = unwrap(
    await backend.from('topic_progress').select('*').eq('user_id', userId).in('course_id', courseIds),
  );
  for (const row of rows) {
    const input = {
      lessonDone: Boolean(row.lesson_done),
      practiceTotal: Number(row.practice_total ?? 0),
      practiceCorrect: Number(row.practice_correct ?? 0),
      recentTotal: Number(row.recent_total ?? 0),
      recentCorrect: Number(row.recent_correct ?? 0),
      selfRating: row.self_rating == null ? null : Number(row.self_rating),
      lastReviewedAt: row.last_reviewed_at ? String(row.last_reviewed_at) : null,
    };
    map.set(String(row.topic_id), {
      topicId: String(row.topic_id),
      courseId: String(row.course_id),
      lessonDone: input.lessonDone,
      lessonDoneAt: row.lesson_done_at ? String(row.lesson_done_at) : null,
      practiceCorrect: input.practiceCorrect,
      practiceTotal: input.practiceTotal,
      recentCorrect: input.recentCorrect,
      recentTotal: input.recentTotal,
      selfRating: input.selfRating,
      lastReviewedAt: input.lastReviewedAt,
      mastery: computeMastery(input),
    });
  }
  return map;
}

export async function getLessonProgressMap(
  userId: string,
  courseIds: string[],
): Promise<Map<string, { completedAt: string; videoPosition: number }>> {
  const map = new Map<string, { completedAt: string; videoPosition: number }>();
  if (!courseIds.length) return map;
  const backend = await db();
  const rows = unwrap(
    await backend.from('lesson_progress').select('*').eq('user_id', userId).in('course_id', courseIds),
  );
  for (const row of rows) {
    map.set(String(row.lesson_id), {
      completedAt: row.completed_at ? String(row.completed_at) : '',
      videoPosition: Number(row.video_position ?? 0),
    });
  }
  return map;
}

export async function completeLesson(
  userId: string,
  lessonId: string,
  courseId: string,
  topicId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const backend = await db();
  unwrap(
    await backend.from('lesson_progress').upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        course_id: courseId,
        topic_id: topicId,
        completed_at: now,
      },
      { onConflict: 'user_id,lesson_id' },
    ),
  );
  await upsertTopicProgress(userId, topicId, courseId, {
    lesson_done: true,
    lesson_done_at: now,
    last_reviewed_at: now,
  });
}

export async function saveVideoPosition(
  userId: string,
  lessonId: string,
  courseId: string,
  topicId: string,
  seconds: number,
): Promise<void> {
  const backend = await db();
  unwrap(
    await backend.from('lesson_progress').upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        course_id: courseId,
        topic_id: topicId,
        video_position: Math.max(0, Math.round(seconds)),
      },
      { onConflict: 'user_id,lesson_id' },
    ),
  );
}

async function upsertTopicProgress(
  userId: string,
  topicId: string,
  courseId: string,
  patch: Row,
): Promise<void> {
  const backend = await db();
  const existing = await firstRow(
    backend.from('topic_progress').select('*').eq('user_id', userId).eq('topic_id', topicId),
  );

  const base: Row = existing ?? {
    user_id: userId,
    topic_id: topicId,
    course_id: courseId,
    lesson_done: false,
    practice_correct: 0,
    practice_total: 0,
    recent_correct: 0,
    recent_total: 0,
    status: 'not-started',
  };
  const merged: Row = { ...base, ...patch, updated_at: new Date().toISOString() };
  const input = {
    lessonDone: Boolean(merged.lesson_done),
    practiceTotal: Number(merged.practice_total ?? 0),
    practiceCorrect: Number(merged.practice_correct ?? 0),
    recentTotal: Number(merged.recent_total ?? 0),
    recentCorrect: Number(merged.recent_correct ?? 0),
    selfRating: merged.self_rating == null ? null : Number(merged.self_rating),
    lastReviewedAt: merged.last_reviewed_at ? String(merged.last_reviewed_at) : null,
  };
  merged.status = computeMastery(input).status;
  merged.practice_correct = Math.min(input.practiceCorrect, input.practiceTotal);
  merged.recent_correct = Math.min(input.recentCorrect, input.recentTotal);

  unwrap(
    await backend.from('topic_progress').upsert(merged, { onConflict: 'user_id,topic_id' }),
  );
}

export async function setSelfRating(userId: string, topicId: string, courseId: string, rating: number | null): Promise<void> {
  await upsertTopicProgress(userId, topicId, courseId, {
    self_rating: rating,
    last_reviewed_at: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ *
 * practice
 * ------------------------------------------------------------------ */

export interface PracticeSummary {
  total: number;
  correct: number;
  accuracy: number | null;
  last30Days: number;
}

export async function getPracticeSummary(userId: string, courseId?: string): Promise<PracticeSummary> {
  const backend = await db();
  let query = backend.from('practice_attempts').select('*').eq('user_id', userId);
  if (courseId) query = query.eq('course_id', courseId);
  const rows = unwrap(await query);
  const graded = rows.filter((r) => r.is_correct !== null);
  const correct = graded.filter((r) => r.is_correct === true).length;
  const cutoff = Date.now() - DAY_MS * 30;
  const last30Days = rows.filter((r) => new Date(String(r.created_at)).getTime() >= cutoff).length;
  return {
    total: graded.length,
    correct,
    accuracy: graded.length ? correct / graded.length : null,
    last30Days,
  };
}

export async function recordAttempt(
  userId: string,
  input: {
    questionId: string;
    topicId: string;
    courseId: string;
    answer: unknown;
    isCorrect: boolean | null;
    timeSpentSeconds: number;
    runId?: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const backend = await db();
  unwrap(
    await backend.from('practice_attempts').insert({
      user_id: userId,
      question_id: input.questionId,
      topic_id: input.topicId,
      course_id: input.courseId,
      answer: input.answer,
      is_correct: input.isCorrect,
      time_spent_seconds: Math.min(Math.max(0, Math.round(input.timeSpentSeconds)), 7200),
      run_id: input.runId ?? null,
      created_at: now,
    }),
  );

  if (input.isCorrect === null) return;

  // Roll the attempt into the topic's mastery inputs. `recent_*` is a small
  // rolling window so a topic can recover after a bad week.
  const existing = await firstRow(
    backend
      .from('topic_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('topic_id', input.topicId),
  );

  const practiceTotal = Number(existing?.practice_total ?? 0) + 1;
  const practiceCorrect = Number(existing?.practice_correct ?? 0) + (input.isCorrect ? 1 : 0);
  const recentTotal = Math.min(5, Number(existing?.recent_total ?? 0) + 1);
  const recentCorrect = Math.min(
    recentTotal,
    Number(existing?.recent_correct ?? 0) + (input.isCorrect ? 1 : 0),
  );

  await upsertTopicProgress(userId, input.topicId, input.courseId, {
    practice_total: practiceTotal,
    practice_correct: practiceCorrect,
    recent_total: recentTotal,
    recent_correct: recentCorrect,
    last_reviewed_at: now,
  });
}

export interface TopicStrength {
  topic: Topic;
  progress: TopicProgress;
}

export async function getTopicStrengths(
  userId: string,
  course: Course,
): Promise<{ weak: TopicStrength[]; strong: TopicStrength[] }> {
  const map = await getTopicProgressMap(userId, [course.id]);
  const touched: TopicStrength[] = [];
  for (const topic of course.topics) {
    const progress = map.get(topic.id);
    if (progress && progress.practiceTotal >= 2) touched.push({ topic, progress });
  }

  const weak = touched
    .filter((x) => x.progress.mastery.status === 'practicing' || (x.progress.mastery.accuracy ?? 1) < 0.6)
    .sort((a, b) => (a.progress.mastery.accuracy ?? 0) - (b.progress.mastery.accuracy ?? 0))
    .slice(0, 5);

  const strong = touched
    .filter((x) => x.progress.mastery.status === 'strong' || x.progress.mastery.status === 'mastered')
    .sort((a, b) => (b.progress.mastery.accuracy ?? 0) - (a.progress.mastery.accuracy ?? 0))
    .slice(0, 5);

  return { weak, strong };
}

export interface CourseRollup {
  course: Course;
  topics: number;
  lessonsDone: number;
  masteryCounts: Record<MasteryStatus, number>;
  completion: number;
  accuracy: number | null;
  practiceTotal: number;
  seconds: number;
  currentUnit: { code: string; title: string; done: number; total: number } | null;
}

export async function getCourseRollups(userId: string): Promise<Map<string, CourseRollup>> {
  const enrollments = await getEnrollments(userId);
  const courseIds = enrollments.map((e) => e.courseId);
  const out = new Map<string, CourseRollup>();
  if (!courseIds.length) return out;

  const [progressMap, lessonMap, sessions] = await Promise.all([
    getTopicProgressMap(userId, courseIds),
    getLessonProgressMap(userId, courseIds),
    getRecentSessions(userId, 400),
  ]);

  const secondsByCourse = new Map<string, number>();
  for (const s of sessions) {
    secondsByCourse.set(s.courseId, (secondsByCourse.get(s.courseId) ?? 0) + s.durationSeconds);
  }

  for (const course of enrollments.map((e) => e.course)) {
    const counts: Record<MasteryStatus, number> = {
      'not-started': 0,
      learning: 0,
      practicing: 0,
      strong: 0,
      mastered: 0,
    };
    let lessonsDone = 0;
    let correct = 0;
    let attempts = 0;

    for (const topic of course.topics) {
      const p = progressMap.get(topic.id);
      const lesson = topic.lesson;
      const done = lesson ? Boolean(lessonMap.get(lesson.id)?.completedAt) : false;
      if (done) lessonsDone += 1;
      const status = p?.mastery.status ?? (done ? 'learning' : 'not-started');
      counts[status] += 1;
      if (p) {
        correct += p.practiceCorrect;
        attempts += p.practiceTotal;
      }
    }

    let currentUnit: CourseRollup['currentUnit'] = null;
    for (const unit of course.units) {
      const done = unit.topics.filter((t) => {
        const p = progressMap.get(t.id);
        return p?.lessonDone || (t.lesson ? Boolean(lessonMap.get(t.lesson.id)?.completedAt) : false);
      }).length;
      if (done < unit.topics.length) {
        currentUnit = { code: unit.code, title: unit.title, done, total: unit.topics.length };
        break;
      }
    }

    const weighted = counts.learning * 0.25 + counts.practicing * 0.5 + counts.strong * 0.75 + counts.mastered;
    out.set(course.id, {
      course,
      topics: course.topics.length,
      lessonsDone,
      masteryCounts: counts,
      completion: course.topics.length ? Math.round((weighted / course.topics.length) * 100) : 0,
      accuracy: attempts ? correct / attempts : null,
      practiceTotal: attempts,
      seconds: secondsByCourse.get(course.id) ?? 0,
      currentUnit,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * activity feed
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * pacing — the per-course schedule
 * ------------------------------------------------------------------ */

export interface Pacing {
  courseId: string;
  startDate: string;
  endDate: string;
  weeklyMinutes: number;
  mode: 'calendar' | 'time';
  updatedAt: string;
}

function mapPacing(row: Row): Pacing {
  return {
    courseId: String(row.course_id),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    weeklyMinutes: Number(row.weekly_minutes ?? 150),
    mode: row.mode === 'time' ? 'time' : 'calendar',
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function getPacing(userId: string, courseId: string): Promise<Pacing | null> {
  const backend = await db();
  const row = await firstRow(
    backend.from('study_pacing').select('*').eq('user_id', userId).eq('course_id', courseId),
  );
  return row ? mapPacing(row) : null;
}

export async function listPacing(userId: string): Promise<Map<string, Pacing>> {
  const backend = await db();
  const rows = unwrap(await backend.from('study_pacing').select('*').eq('user_id', userId));
  return new Map(rows.map((row) => [String(row.course_id), mapPacing(row)]));
}

/**
 * Save the pacing inputs. One row per student per course — a schedule is a
 * decision, not a history, so re-planning replaces it. What actually
 * happened stays in `study_sessions`.
 */
export async function savePacing(
  userId: string,
  input: Omit<Pacing, 'courseId' | 'updatedAt'> & { courseId: string },
): Promise<Pacing> {
  const backend = await db();
  unwrap(
    await backend.from('study_pacing').upsert(
      {
        user_id: userId,
        course_id: input.courseId,
        start_date: input.startDate,
        end_date: input.endDate,
        weekly_minutes: clampGoal(input.weeklyMinutes),
        mode: input.mode,
      },
      { onConflict: 'user_id,course_id' },
    ),
  );
  const saved = await getPacing(userId, input.courseId);
  if (!saved) throw new Error('Could not read back the pacing plan');
  return saved;
}

export async function deletePacing(userId: string, courseId: string): Promise<void> {
  const backend = await db();
  unwrap(
    await backend.from('study_pacing').delete().eq('user_id', userId).eq('course_id', courseId),
  );
}

export async function getRecentActivity(userId: string, limit = 6): Promise<ActivityItem[]> {
  const enrollments = await getEnrollments(userId);
  const accentOf = new Map(enrollments.map((e) => [e.courseId, e.course.accent]));
  const nameOf = new Map(enrollments.map((e) => [e.courseId, e.course.shortName]));
  const backend = await db();

  const [lessons, attempts, openSessions] = await Promise.all([
    backend
      .from('lesson_progress')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit),
    backend
      .from('practice_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit * 2),
    backend
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('discarded', false)
      .is('ended_at', null)
      .limit(1),
  ]);

  const items: ActivityItem[] = [];

  /* A session that is still running is the most recent thing that happened,
   * so it heads the feed. It is pinned to `now` because it has no end time. */
  const open = unwrap(openSessions).map(mapSession)[0];
  if (open) {
    const topic = open.topicId ? getTopic(open.topicId) : null;
    items.push({
      id: `session:${open.id}`,
      kind: 'session',
      title: 'Studying now',
      subtitle: topic
        ? `${nameOf.get(open.courseId) ?? 'Course'} · ${topic.code} ${topic.title}`
        : `${nameOf.get(open.courseId) ?? 'Course'} · session running`,
      at: new Date().toISOString(),
      accent: accentOf.get(open.courseId) ?? 'stat',
    });
  }

  for (const row of unwrap(lessons)) {
    if (!row.completed_at) continue;
    const topic = getTopic(String(row.topic_id));
    const courseId = String(row.course_id);
    items.push({
      id: `lesson:${row.lesson_id}`,
      kind: 'lesson',
      title: `Finished ${topic ? `Topic ${topic.code}` : 'a lesson'}`,
      subtitle: topic ? `${nameOf.get(courseId) ?? 'Course'} · ${topic.title}` : 'Lesson completed',
      at: String(row.completed_at),
      accent: accentOf.get(courseId) ?? 'stat',
    });
  }

  const runs = new Map<string, { count: number; at: string; courseId: string }>();
  for (const row of unwrap(attempts)) {
    const key = row.run_id ? String(row.run_id) : String(row.created_at).slice(0, 13);
    const existing = runs.get(key);
    if (existing) {
      existing.count += 1;
      if (String(row.created_at) > existing.at) existing.at = String(row.created_at);
    } else {
      runs.set(key, { count: 1, at: String(row.created_at), courseId: String(row.course_id) });
    }
  }
  for (const [key, run] of runs) {
    items.push({
      id: `practice:${key}`,
      kind: 'practice',
      title: `Practiced ${run.count} question${run.count === 1 ? '' : 's'}`,
      subtitle: `${nameOf.get(run.courseId) ?? 'Course'} · practice run`,
      at: run.at,
      accent: accentOf.get(run.courseId) ?? 'stat',
    });
  }

  return items
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * notes
 * ------------------------------------------------------------------ */

export interface Note {
  id: string;
  courseId: string | null;
  unitId: string | null;
  topicId: string | null;
  lessonId: string | null;
  title: string;
  body: string;
  checklist: { text: string; done: boolean }[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapNote(row: Row): Note {
  return {
    id: String(row.id),
    courseId: row.course_id ? String(row.course_id) : null,
    unitId: row.unit_id ? String(row.unit_id) : null,
    topicId: row.topic_id ? String(row.topic_id) : null,
    lessonId: row.lesson_id ? String(row.lesson_id) : null,
    title: String(row.title ?? 'Untitled note'),
    body: String(row.body ?? ''),
    checklist: (row.checklist as { text: string; done: boolean }[]) ?? [],
    pinned: Boolean(row.pinned),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function listNotes(userId: string, courseId?: string): Promise<Note[]> {
  const backend = await db();
  let query = backend.from('notes').select('*').eq('user_id', userId);
  if (courseId) query = query.eq('course_id', courseId);
  const rows = unwrap(await query.order('pinned', { ascending: false }).order('updated_at', { ascending: false }));
  return rows.map(mapNote);
}

export async function getNote(userId: string, noteId: string): Promise<Note | null> {
  const backend = await db();
  const row = await firstRow(backend.from('notes').select('*').eq('user_id', userId).eq('id', noteId));
  return row ? mapNote(row) : null;
}

export async function saveNote(
  userId: string,
  input: {
    id?: string;
    courseId?: string | null;
    unitId?: string | null;
    topicId?: string | null;
    lessonId?: string | null;
    title: string;
    body: string;
    checklist?: { text: string; done: boolean }[];
    pinned?: boolean;
  },
): Promise<Note> {
  const now = new Date().toISOString();
  const values: Row = {
    title: input.title.slice(0, 160) || 'Untitled note',
    body: input.body.slice(0, 20000),
    checklist: (input.checklist ?? []).slice(0, 100),
    course_id: input.courseId ?? null,
    unit_id: input.unitId ?? null,
    topic_id: input.topicId ?? null,
    lesson_id: input.lessonId ?? null,
    updated_at: now,
  };
  if (input.pinned !== undefined) values.pinned = input.pinned;

  const backend = await db();
  if (input.id) {
    unwrap(await backend.from('notes').update(values).eq('user_id', userId).eq('id', input.id).select());
    return (await getNote(userId, input.id))!;
  }
  const rows = unwrap(await backend.from('notes').insert({ ...values, user_id: userId, created_at: now }).select());
  return mapNote(rows[0]);
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  const backend = await db();
  unwrap(await backend.from('notes').delete().eq('user_id', userId).eq('id', noteId));
}

/* ------------------------------------------------------------------ *
 * planner
 * ------------------------------------------------------------------ */

export interface StudyPlan {
  id: string;
  courseId: string;
  unitId: string | null;
  kind: 'goal' | 'weekly';
  title: string;
  targetDate: string | null;
  template: { day: number; minutes: number }[];
  status: string;
  createdAt: string;
}

function mapPlan(row: Row): StudyPlan {
  return {
    id: String(row.id),
    courseId: String(row.course_id),
    unitId: row.unit_id ? String(row.unit_id) : null,
    kind: row.kind === 'weekly' ? 'weekly' : 'goal',
    title: String(row.title ?? ''),
    targetDate: row.target_date ? String(row.target_date) : null,
    template: (row.template as { day: number; minutes: number }[]) ?? [],
    status: String(row.status ?? 'active'),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function listPlans(userId: string): Promise<StudyPlan[]> {
  const backend = await db();
  const rows = unwrap(
    await backend
      .from('study_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  );
  return rows.map(mapPlan);
}

export async function createPlan(
  userId: string,
  input: Omit<StudyPlan, 'id' | 'createdAt' | 'status'>,
): Promise<StudyPlan> {
  const now = new Date().toISOString();
  const backend = await db();
  const rows = unwrap(
    await backend
      .from('study_plans')
      .insert({
        user_id: userId,
        course_id: input.courseId,
        unit_id: input.unitId,
        kind: input.kind,
        title: input.title.slice(0, 160),
        target_date: input.targetDate,
        template: input.template,
        status: 'active',
        created_at: now,
      })
      .select(),
  );
  return mapPlan(rows[0]);
}

export async function deletePlan(userId: string, planId: string): Promise<void> {
  const backend = await db();
  unwrap(await backend.from('study_plans').delete().eq('user_id', userId).eq('id', planId));
}

/* ------------------------------------------------------------------ *
 * search
 * ------------------------------------------------------------------ */

export async function globalSearch(userId: string, query: string): Promise<SearchResult[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];
  const backend = await db();
  const rows = unwrap(await backend.rpc('global_search', { query: clean, max_rows: 24 }));
  return rows.map((r) => ({
    kind: String(r.kind),
    id: String(r.id),
    title: String(r.title),
    subtitle: String(r.subtitle),
    href: String(r.href),
  }));
}

/* ------------------------------------------------------------------ *
 * data export + account deletion
 * ------------------------------------------------------------------ */

export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const backend = await db();
  const [profile, enrollments, sessions, progress, lessons, attempts, notes, plans, pacing] =
    await Promise.all([
      backend.from('profiles').select('*').eq('id', userId).maybeSingle(),
      backend.from('user_courses').select('*').eq('user_id', userId),
      backend.from('study_sessions').select('*').eq('user_id', userId),
      backend.from('topic_progress').select('*').eq('user_id', userId),
      backend.from('lesson_progress').select('*').eq('user_id', userId),
      backend.from('practice_attempts').select('*').eq('user_id', userId),
      backend.from('notes').select('*').eq('user_id', userId),
      backend.from('study_plans').select('*').eq('user_id', userId),
      backend.from('study_pacing').select('*').eq('user_id', userId),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: unwrapOne(profile as { data: Row | null; error: null }),
    courses: unwrap(enrollments).map((r) => ({
      slug: COURSE_BY_ID.get(String(r.course_id))?.slug ?? String(r.course_id),
      weeklyGoalMinutes: Number(r.default_weekly_minutes ?? 0),
    })),
    studySessions: unwrap(sessions),
    topicProgress: unwrap(progress),
    lessonProgress: unwrap(lessons),
    practiceAttempts: unwrap(attempts),
    notes: unwrap(notes),
    studyPlans: unwrap(plans),
    pacing: unwrap(pacing),
  };
}

/**
 * Delete every row the user owns. `auth.users` is removed last by the
 * caller; the `on delete cascade` foreign keys then take care of the rest.
 */
export async function deleteAllUserData(userId: string): Promise<void> {
  const backend = await db();
  const tables = [
    'practice_attempts',
    'notes',
    'study_plans',
    'study_pacing',
    'lesson_progress',
    'topic_progress',
    'study_sessions',
    'weekly_goals',
    'user_courses',
    'profiles',
  ];
  for (const table of tables) {
    const key = table === 'profiles' ? 'id' : 'user_id';
    unwrap(await backend.from(table).delete().eq(key, userId));
  }
}

/* ------------------------------------------------------------------ *
 * recommendation — deterministic, and able to explain itself
 * ------------------------------------------------------------------ */

export interface Recommendation {
  course: Course;
  unit: { code: string; title: string };
  topic: Topic;
  reasons: string[];
  href: string;
  unitProgress: { done: number; total: number };
}

export async function getRecommendation(userId: string): Promise<Recommendation | null> {
  const enrollments = await getEnrollments(userId);
  if (!enrollments.length) return null;
  const courseIds = enrollments.map((e) => e.courseId);
  const [progressMap, lessonMap] = await Promise.all([
    getTopicProgressMap(userId, courseIds),
    getLessonProgressMap(userId, courseIds),
  ]);

  let best: { score: number; rec: Recommendation } | null = null;

  enrollments.forEach((enrollment, courseIndex) => {
    const course = enrollment.course;

    // The working unit is the first one with unfinished topics.
    let workingUnit = course.units[0];
    for (const unit of course.units) {
      const done = unit.topics.every((t) => {
        const p = progressMap.get(t.id);
        return p?.lessonDone || (t.lesson ? Boolean(lessonMap.get(t.lesson.id)?.completedAt) : false);
      });
      if (!done) {
        workingUnit = unit;
        break;
      }
    }

    const unitDone = workingUnit.topics.filter((t) => {
      const p = progressMap.get(t.id);
      return p?.lessonDone || (t.lesson ? Boolean(lessonMap.get(t.lesson.id)?.completedAt) : false);
    }).length;

    for (const topic of course.topics) {
      const p = progressMap.get(topic.id);
      const lesson = topic.lesson;
      const done = lesson ? Boolean(lessonMap.get(lesson.id)?.completedAt) : false;
      const inWorkingUnit = topic.unitId === workingUnit.id;
      const accuracy = p?.mastery.accuracy ?? null;

      let score = 0;
      const reasons: string[] = [];

      if (accuracy !== null && accuracy < 0.6 && (p?.practiceTotal ?? 0) >= 2) {
        score += 95;
        reasons.push(`Recent practice on this topic is ${Math.round(accuracy * 100)}% correct`);
      }
      if (!done && lesson) {
        score += 55;
        reasons.push("You haven't finished this lesson yet");
      }
      if (done && !p?.practiceTotal && topic.questions.length) {
        score += 40;
        reasons.push('Lesson done — no practice on it yet');
      }
      if (inWorkingUnit) {
        score += 30;
        reasons.push(`You are working through Unit ${workingUnit.code}`);
      }
      if (p?.mastery.status === 'mastered' || p?.mastery.status === 'strong') {
        score -= 70;
      }
      if (!lesson) score -= 20;

      // Deterministic tie-break: earlier course, then earlier topic.
      score -= courseIndex * 2 + topic.position * 0.1;

      if (score <= 0) continue;
      const unit = getUnit(topic.unitId);
      if (!best || score > best.score) {
        best = {
          score,
          rec: {
            course,
            unit: { code: unit?.code ?? workingUnit.code, title: unit?.title ?? workingUnit.title },
            topic,
            reasons: reasons.slice(0, 3),
            href: lesson ? `/learn/${lesson.id}` : `/courses/${course.slug}/topics/${topic.code}`,
            unitProgress: { done: unitDone, total: workingUnit.topics.length },
          },
        };
      }
    }
  });

  return best ? (best as { score: number; rec: Recommendation }).rec : null;
}
