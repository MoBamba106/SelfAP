/* ------------------------------------------------------------------ *
 * Pacing — turning a curriculum into a week-by-week schedule.
 *
 * Pure and deterministic: no database, no clock reads inside. Given the
 * same inputs it always returns the same plan, which is what makes
 * "you are two topics behind" a statement rather than a mood.
 * ------------------------------------------------------------------ */

import { addDays, weekStart } from '@/lib/utils/time';
import type { Course, Topic } from '@/content';

/** A topic with no authored lesson still takes time — the outline and practice do. */
const DEFAULT_LESSON_MINUTES = 15;
/** Rough minutes to answer one question properly, including reading the explanation. */
const MINUTES_PER_QUESTION = 3;
/** Re-reading and note-writing overhead, as a fraction of the raw total. */
const OVERHEAD = 1.15;

export type PaceMode = 'calendar' | 'time';

export interface PaceInputs {
  startDate: Date;
  endDate: Date;
  weeklyMinutes: number;
  mode: PaceMode;
  weekStartDay: number;
  today: Date;
}

export interface PacedTopic {
  topic: Topic;
  estimatedMinutes: number;
  done: boolean;
}

export type WeekStatus = 'done' | 'current' | 'upcoming' | 'overdue';

export interface PacedWeek {
  index: number;
  weekStart: Date;
  weekEnd: Date;
  label: string;
  topics: PacedTopic[];
  estimatedMinutes: number;
  status: WeekStatus;
  doneTopics: number;
}

export interface Schedule {
  weeks: PacedWeek[];
  totalMinutes: number;
  weeklyTarget: number;
  /** Index of the week containing `today`, or null if outside the plan. */
  currentWeekIndex: number | null;
  /** Topics that should be finished by today but are not. */
  behindBy: number;
  aheadBy: number;
  /** 0–100, by estimated minutes rather than topic count. */
  percentComplete: number;
  /** Minutes that should be done by today according to the plan. */
  expectedMinutesByNow: number;
  projectedFinish: Date | null;
  feasible: boolean;
  reason: string;
}

/** How long a topic realistically takes, including practice and overhead. */
export function estimateTopic(topic: Topic): number {
  const lesson = topic.lesson?.minutes ?? DEFAULT_LESSON_MINUTES;
  const practice = topic.questions.length * MINUTES_PER_QUESTION;
  return Math.round((lesson + practice) * OVERHEAD);
}

function labelFor(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Split an ordered list of weighted items into weeks.
 *
 * 'calendar' spreads the load evenly across the weeks available, so every
 * week asks for roughly the same amount of you. 'time' fills each week to
 * the weekly budget and lets the finish date fall where it falls — which is
 * the honest answer when the deadline is not actually movable.
 */
function allocate(
  items: { topic: Topic; minutes: number }[],
  weekCount: number,
  weeklyMinutes: number,
  mode: PaceMode,
): { topic: Topic; minutes: number }[][] {
  if (!items.length) return [];

  if (mode === 'time' && weeklyMinutes > 0) {
    const weeks: { topic: Topic; minutes: number }[][] = [];
    let current: { topic: Topic; minutes: number }[] = [];
    let filled = 0;
    for (const item of items) {
      if (current.length && filled + item.minutes > weeklyMinutes) {
        weeks.push(current);
        current = [];
        filled = 0;
      }
      current.push(item);
      filled += item.minutes;
    }
    if (current.length) weeks.push(current);
    return weeks;
  }

  const buckets = Math.max(1, Math.min(weekCount, items.length));
  const weeks: { topic: Topic; minutes: number }[][] = Array.from({ length: buckets }, () => []);
  const totals = new Array<number>(buckets).fill(0);

  /* Longest-processing-time first keeps the weeks balanced, then each week
   * is put back into curriculum order so the schedule reads sensibly. */
  const ordered = [...items].sort((a, b) => b.minutes - a.minutes);
  for (const item of ordered) {
    let lightest = 0;
    for (let i = 1; i < buckets; i += 1) if (totals[i]! < totals[lightest]!) lightest = i;
    weeks[lightest]!.push(item);
    totals[lightest]! += item.minutes;
  }

  const byPosition = new Map(items.map((item, i) => [item.topic.id, i]));
  return weeks
    .map((week) => week.sort((a, b) => byPosition.get(a.topic.id)! - byPosition.get(b.topic.id)!))
    .filter((week) => week.length > 0);
}

/**
 * Build the schedule.
 *
 * @param doneTopicIds topics the student has actually finished — used to mark
 *   weeks as done and to work out whether they are behind.
 */
export function buildSchedule(
  course: Course,
  inputs: PaceInputs,
  doneTopicIds: ReadonlySet<string>,
): Schedule {
  const items = course.topics.map((topic) => ({
    topic,
    minutes: estimateTopic(topic),
  }));
  const totalMinutes = items.reduce((sum, item) => sum + item.minutes, 0);

  const startWeek = weekStart(inputs.startDate, inputs.weekStartDay);
  const endWeek = weekStart(inputs.endDate, inputs.weekStartDay);
  const rawWeekCount = Math.max(
    1,
    Math.round((endWeek.getTime() - startWeek.getTime()) / (7 * 86_400_000)) + 1,
  );

  const allocated = allocate(items, rawWeekCount, inputs.weeklyMinutes, inputs.mode);
  const weekCount = Math.max(1, allocated.length);
  const weeklyTarget = weekCount ? Math.round(totalMinutes / weekCount) : totalMinutes;

  const todayWeek = weekStart(inputs.today, inputs.weekStartDay);

  let expectedMinutesByNow = 0;
  let doneMinutes = 0;

  const weeks: PacedWeek[] = allocated.map((bucket, index) => {
    const wStart = addDays(startWeek, index * 7);
    const wEnd = addDays(wStart, 6);
    const topics: PacedTopic[] = bucket.map((item) => ({
      topic: item.topic,
      estimatedMinutes: item.minutes,
      done: doneTopicIds.has(item.topic.id),
    }));
    const estimatedMinutes = bucket.reduce((sum, item) => sum + item.minutes, 0);
    const doneTopics = topics.filter((t) => t.done).length;

    if (wEnd < inputs.today) expectedMinutesByNow += estimatedMinutes;
    else if (wStart <= inputs.today && wEnd >= inputs.today) {
      /* Part-way through the current week: expect a proportional share. */
      const dayOfWeek = Math.round(
        (inputs.today.getTime() - wStart.getTime()) / 86_400_000,
      );
      expectedMinutesByNow += Math.round((estimatedMinutes * (dayOfWeek + 1)) / 7);
    }
    doneMinutes += topics.reduce((sum, t) => sum + (t.done ? t.estimatedMinutes : 0), 0);

    let status: WeekStatus = 'upcoming';
    if (wStart <= todayWeek && wEnd >= todayWeek) status = 'current';
    else if (wEnd < todayWeek) status = doneTopics === topics.length ? 'done' : 'overdue';

    return {
      index,
      weekStart: wStart,
      weekEnd: wEnd,
      label: `Week of ${labelFor(wStart)}`,
      topics,
      estimatedMinutes,
      status,
      doneTopics,
    };
  });

  const currentWeekIndex = weeks.findIndex((w) => w.status === 'current');
  const overdueTopics = weeks
    .filter((w) => w.status === 'overdue')
    .reduce((sum, w) => sum + (w.topics.length - w.doneTopics), 0);

  /* What the plan implies if the student keeps to the weekly target from now. */
  const remainingMinutes = Math.max(0, totalMinutes - doneMinutes);
  const projectedFinish =
    inputs.weeklyMinutes > 0
      ? addDays(inputs.today, Math.ceil(remainingMinutes / inputs.weeklyMinutes) * 7)
      : null;

  const feasible =
    inputs.mode === 'time'
      ? !projectedFinish || projectedFinish <= addDays(inputs.endDate, 7)
      : weeklyTarget <= Math.max(inputs.weeklyMinutes, 1) * 1.5;

  const reason = feasible
    ? inputs.mode === 'time'
      ? 'The weekly budget you set covers the remaining work.'
      : 'The calendar you chose leaves enough room each week.'
    : inputs.mode === 'time'
      ? 'At this weekly budget you would finish after your target date. Add time each week or move the date.'
      : 'This asks for more per week than your budget allows. Move the finish date out or raise the weekly time.';

  return {
    weeks,
    totalMinutes,
    weeklyTarget,
    currentWeekIndex: currentWeekIndex === -1 ? null : currentWeekIndex,
    behindBy: overdueTopics,
    aheadBy: 0,
    percentComplete: totalMinutes ? Math.round((doneMinutes / totalMinutes) * 100) : 0,
    expectedMinutesByNow,
    projectedFinish,
    feasible,
    reason,
  };
}
