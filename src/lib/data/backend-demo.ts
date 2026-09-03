import {
  COURSES,
  ALL_TOPICS,
  LESSON_BY_ID,
  deterministicId,
  type Course,
} from '@/content';
import type {
  Backend,
  MutationBuilder,
  OrderOptions,
  QueryBuilder,
  QueryResult,
  Row,
  TableApi,
} from './backend';

/* ------------------------------------------------------------------ *
 * In-memory backend.
 *
 * Used when the app is run without Supabase credentials so the whole UI
 * can be exercised end to end: dashboard, timer, practice, progress,
 * planner, notes, search. It implements the same query subset as the
 * Supabase backend, so repository code does not know the difference.
 *
 * State is per-process and resets on restart. It is never used in
 * production — set NEXT_PUBLIC_SUPABASE_URL and the Supabase backend
 * takes over automatically.
 * ------------------------------------------------------------------ */

export const DEMO_USER_ID = deterministicId('selfap:demo-user');

type Sorter = { column: string; ascending: boolean };

interface Filter {
  kind: 'eq' | 'neq' | 'in' | 'gte' | 'gt' | 'lte' | 'lt' | 'is' | 'ilike';
  column: string;
  value: unknown;
}

function testFilter(row: Row, f: Filter): boolean {
  const v = row[f.column];
  switch (f.kind) {
    case 'eq':
      return v === f.value;
    case 'neq':
      return v !== f.value;
    case 'in':
      return Array.isArray(f.value) && f.value.includes(v);
    case 'gte':
      return Number(v) >= Number(f.value);
    case 'gt':
      return Number(v) > Number(f.value);
    case 'lte':
      return Number(v) <= Number(f.value);
    case 'lt':
      return Number(v) < Number(f.value);
    case 'is':
      return f.value === null ? v === null || v === undefined : v === f.value;
    case 'ilike': {
      const pattern = String(f.value).replace(/%/g, '.*');
      return new RegExp(`^${pattern}$`, 'i').test(String(v ?? ''));
    }
    default:
      return true;
  }
}

function applyOrder(rows: Row[], sorters: Sorter[]): Row[] {
  if (!sorters.length) return rows;
  return [...rows].sort((a, b) => {
    for (const s of sorters) {
      const av = a[s.column];
      const bv = b[s.column];
      if (av === bv) continue;
      if (av === null || av === undefined) return s.ascending ? -1 : 1;
      if (bv === null || bv === undefined) return s.ascending ? 1 : -1;
      const cmp = av < bv ? -1 : 1;
      return s.ascending ? cmp : -cmp;
    }
    return 0;
  });
}

const DEFAULTS: Record<string, Row> = {
  study_sessions: { discarded: false, mode: 'focus', notes: '', duration_seconds: 0 },
  topic_progress: {
    lesson_done: false,
    practice_correct: 0,
    practice_total: 0,
    recent_correct: 0,
    recent_total: 0,
    status: 'not-started',
    self_rating: null,
  },
  lesson_progress: { video_position: 0 },
  notes: { pinned: false, checklist: [] },
  study_plans: { kind: 'goal', status: 'active', template: [] },
  study_pacing: { mode: 'calendar', weekly_minutes: 150 },
  profiles: { role: 'student', preferences: {}, week_start_day: 1, timezone: 'UTC' },
};

class DemoQuery<T> implements QueryBuilder<T>, MutationBuilder<T> {
  private rows: Row[];
  private filters: Filter[] = [];
  private sorters: Sorter[] = [];
  private max = Number.POSITIVE_INFINITY;
  private writePayload: Row[] | null = null;
  private writeKind: 'insert' | 'upsert' | 'update' | 'delete' | null = null;
  private onConflict: string | null = null;
  private returnRows = false;

  constructor(
    private store: Map<string, Row[]>,
    private table: string,
  ) {
    this.rows = store.get(table) ?? [];
  }

  asInsert(payload: Row[], kind: 'insert' | 'upsert', onConflict?: string): this {
    this.writePayload = payload;
    this.writeKind = kind;
    this.onConflict = onConflict ?? null;
    return this;
  }

  asUpdate(values: Row): this {
    this.writePayload = [values];
    this.writeKind = 'update';
    return this;
  }

  asDelete(): this {
    this.writeKind = 'delete';
    return this;
  }

  // --- query builder -----------------------------------------------------
  eq(column: string, value: unknown): this {
    this.filters.push({ kind: 'eq', column, value });
    return this;
  }
  neq(column: string, value: unknown): this {
    this.filters.push({ kind: 'neq', column, value });
    return this;
  }
  in(column: string, values: readonly unknown[]): this {
    this.filters.push({ kind: 'in', column, value: [...values] });
    return this;
  }
  gte(column: string, value: unknown): this {
    this.filters.push({ kind: 'gte', column, value });
    return this;
  }
  gt(column: string, value: unknown): this {
    this.filters.push({ kind: 'gt', column, value });
    return this;
  }
  lte(column: string, value: unknown): this {
    this.filters.push({ kind: 'lte', column, value });
    return this;
  }
  lt(column: string, value: unknown): this {
    this.filters.push({ kind: 'lt', column, value });
    return this;
  }
  is(column: string, value: null | boolean): this {
    this.filters.push({ kind: 'is', column, value });
    return this;
  }
  ilike(column: string, pattern: string): this {
    this.filters.push({ kind: 'ilike', column, value: pattern });
    return this;
  }
  order(column: string, options?: OrderOptions): this {
    this.sorters.push({ column, ascending: options?.ascending ?? true });
    return this;
  }
  limit(count: number): this {
    this.max = count;
    return this;
  }
  select(): this {
    this.returnRows = true;
    return this;
  }

  private matched(): Row[] {
    return this.rows.filter((row) => this.filters.every((f) => testFilter(row, f)));
  }

  private commit(): Row[] {
    const now = new Date().toISOString();
    const list = this.store.get(this.table) ?? [];
    const affected: Row[] = [];

    if (this.writeKind === 'insert' || this.writeKind === 'upsert') {
      const payload = this.writePayload ?? [];
      for (const incoming of payload) {
        const merged: Row = { ...(DEFAULTS[this.table] ?? {}), ...incoming };
        if (!merged.id) merged.id = deterministicId(`${this.table}:${Math.random()}:${now}`);
        if (!merged.created_at) merged.created_at = now;
        merged.updated_at = now;

        const conflict = this.onConflict ? String(this.onConflict).split(',') : ['id'];
        const idx = list.findIndex((existing) =>
          conflict.every((c) => existing[c.trim()] === merged[c.trim()]),
        );
        if (idx >= 0) {
          if (this.writeKind === 'upsert') {
            list[idx] = { ...list[idx], ...merged };
            affected.push(list[idx]);
          }
        } else {
          list.push(merged);
          affected.push(merged);
        }
      }
    } else if (this.writeKind === 'update') {
      const patch = this.writePayload?.[0] ?? {};
      for (const row of this.matched()) {
        Object.assign(row, patch, { updated_at: now });
        affected.push(row);
      }
    } else if (this.writeKind === 'delete') {
      const doomed = new Set(this.matched());
      const kept = list.filter((r) => !doomed.has(r));
      this.store.set(this.table, kept);
      return [];
    }

    this.store.set(this.table, list);
    return affected;
  }

  private result(): QueryResult<Row[]> {
    const written = this.writeKind ? this.commit() : null;
    const source = written ?? applyOrder(this.matched(), this.sorters).slice(0, this.max);
    return { data: this.returnRows || written ? source : source, error: null };
  }

  then<R1 = QueryResult<T[]>, R2 = never>(
    onfulfilled?: ((value: QueryResult<T[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.result() as QueryResult<T[]>).then(onfulfilled, onrejected);
  }

  async single(): Promise<QueryResult<T>> {
    const r = this.result();
    const rows = r.data ?? [];
    if (!rows.length) return { data: null, error: { message: 'no rows', code: 'PGRST116' } };
    return { data: rows[0] as T, error: null };
  }

  async maybeSingle(): Promise<QueryResult<T>> {
    const r = this.result();
    return { data: (r.data?.[0] as T) ?? null, error: null };
  }
}

/* ------------------------------------------------------------------ *
 * Seed
 * ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOALS: Record<string, number> = {
  'ap-statistics': 180,
  'ap-us-government-and-politics': 120,
  'ap-english-language-and-composition': 120,
  'ap-english-literature-and-composition': 120,
};

function isoWeekStart(date: Date, weekStartDay: number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const shift = (d.getDay() - weekStartDay + 7) % 7;
  d.setDate(d.getDate() - shift);
  return d;
}

function seedTables(): Map<string, Row[]> {
  const store = new Map<string, Row[]>();
  const rand = mulberry32(20270513);
  const now = new Date();

  store.set('profiles', [
    {
      id: DEMO_USER_ID,
      email: 'demo@selfap.app',
      display_name: 'Alex Rivera',
      timezone: 'America/New_York',
      week_start_day: 1,
      exam_year: 2027,
      preferences: { theme: 'paper', timerSound: true, dailyReminder: '19:00' },
      role: 'student',
      created_at: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 168).toISOString(),
      updated_at: now.toISOString(),
    },
  ]);

  const enrollments: Row[] = [];
  COURSES.forEach((course, index) => {
    enrollments.push({
      user_id: DEMO_USER_ID,
      course_id: course.id,
      default_weekly_minutes: GOALS[course.slug] ?? 120,
      active: true,
      position: index,
      enrolled_at: new Date(now.getTime() - 1000 * 60 * 60 * 24 * (150 - index * 6)).toISOString(),
    });
  });
  store.set('user_courses', enrollments);

  // Weekly goal snapshots for the current and previous 7 weeks.
  const weeklyGoals: Row[] = [];
  const thisWeek = isoWeekStart(now, 1);
  for (let w = 7; w >= 0; w -= 1) {
    const weekStart = new Date(thisWeek);
    weekStart.setDate(weekStart.getDate() - w * 7);
    for (const course of COURSES) {
      weeklyGoals.push({
        user_id: DEMO_USER_ID,
        course_id: course.id,
        week_start: weekStart.toISOString().slice(0, 10),
        minutes: GOALS[course.slug] ?? 120,
        updated_at: weekStart.toISOString(),
      });
    }
  }
  store.set('weekly_goals', weeklyGoals);

  /* Study sessions ------------------------------------------------------ *
   * Six full weeks of history plus a partial current week, so the progress
   * page has a real trend line and the dashboard shows in-flight goals.
   */
  const sessions: Row[] = [];
  const lessonDone: Row[] = [];
  const attempts: Row[] = [];

  interface SeedProgress {
    [key: string]: unknown;
    user_id: string;
    topic_id: string;
    course_id: unknown;
    lesson_done: boolean;
    lesson_done_at: string | null;
    practice_correct: number;
    practice_total: number;
    recent_correct: number;
    recent_total: number;
    status: string;
    self_rating: number | null;
    last_reviewed_at: string | null;
    updated_at: unknown;
  }
  const topicProgress = new Map<string, SeedProgress>();

  // How far each course has progressed, in completed lessons.
  const progressDepth: Record<string, number> = {
    'ap-statistics': 24,
    'ap-us-government-and-politics': 17,
    'ap-english-language-and-composition': 12,
    'ap-english-literature-and-composition': 8,
  };

  for (const course of COURSES) {
    const depth = progressDepth[course.slug] ?? 0;
    const lessons = course.topics
      .map((t) => t.lesson)
      .filter((l): l is NonNullable<typeof l> => Boolean(l))
      .slice(0, depth);

    // Spread the completed lessons across the last 7 weeks.
    lessons.forEach((lesson, index) => {
      const weeksAgo = Math.floor(((lessons.length - index) / lessons.length) * 6.6);
      const topic = course.topics.find((t) => t.lesson?.id === lesson.id);
      if (!topic) return;

      const minutes = lesson.minutes + Math.floor(rand() * 8) - 3;
      const dayOffset = weeksAgo * 7 + Math.floor(rand() * 6) + 1;
      const start = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      start.setHours(16 + Math.floor(rand() * 5), Math.floor(rand() * 60), 0, 0);
      const end = new Date(start.getTime() + Math.max(4, minutes) * 60 * 1000);

      sessions.push({
        id: deterministicId(`seed-session:${lesson.id}`),
        user_id: DEMO_USER_ID,
        course_id: course.id,
        unit_id: topic.unitId,
        topic_id: topic.id,
        lesson_id: lesson.id,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        duration_seconds: Math.max(4, minutes) * 60,
        mode: 'lesson',
        notes: '',
        discarded: false,
        created_at: start.toISOString(),
      });

      lessonDone.push({
        user_id: DEMO_USER_ID,
        lesson_id: lesson.id,
        course_id: course.id,
        topic_id: topic.id,
        completed_at: end.toISOString(),
        video_position: 0,
        updated_at: end.toISOString(),
      });
    });

    // Extra practice sessions in the last three weeks.
    for (let w = 0; w < 3; w += 1) {
      const perWeek = 2 + Math.floor(rand() * 2);
      for (let s = 0; s < perWeek; s += 1) {
        const dayOffset = w * 7 + Math.floor(rand() * 6) + 1;
        const start = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
        start.setHours(17 + Math.floor(rand() * 4), Math.floor(rand() * 60), 0, 0);
        const mins = 18 + Math.floor(rand() * 26);
        const topic = course.topics[Math.floor(rand() * Math.min(depth, course.topics.length))];
        if (!topic) continue;
        sessions.push({
          id: deterministicId(`seed-practice:${course.slug}:${w}:${s}`),
          user_id: DEMO_USER_ID,
          course_id: course.id,
          unit_id: topic.unitId,
          topic_id: topic.id,
          lesson_id: null,
          started_at: start.toISOString(),
          ended_at: new Date(start.getTime() + mins * 60 * 1000).toISOString(),
          duration_seconds: mins * 60,
          mode: 'practice',
          notes: '',
          discarded: false,
          created_at: start.toISOString(),
        });
      }
    }

    // Practice attempts against the topic's own questions.
    for (const topic of course.topics.slice(0, depth)) {
      for (const question of topic.questions) {
        const tries = 1 + Math.floor(rand() * 2);
        for (let i = 0; i < tries; i += 1) {
          // Topics the student has moved past are mostly right; the frontier
          // is mixed, which is what makes the weak-topic list meaningful.
          const frontier = course.topics.indexOf(topic) > depth - 6;
          const correctChance = frontier ? 0.45 + rand() * 0.2 : 0.75 + rand() * 0.2;
          const correct = rand() < correctChance;
          const dayOffset = Math.floor(rand() * 34);
          attempts.push({
            id: deterministicId(`seed-attempt:${question.id}:${i}`),
            user_id: DEMO_USER_ID,
            question_id: question.id,
            topic_id: topic.id,
            course_id: course.id,
            answer: correct
              ? question.answer
              : question.kind === 'mcq'
                ? (Number(question.answer) + 1) % Math.max(2, question.choices.length)
                : 'partial',
            is_correct: correct,
            time_spent_seconds: 30 + Math.floor(rand() * 120),
            run_id: deterministicId(`seed-run:${course.slug}`),
            created_at: new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      }
    }
  }

  /* One session left running, with a heartbeat that went quiet a while ago.
   * This is the state a crashed or abandoned tab leaves behind, and it is what
   * exercises the resume path on /study and the "Studying now" activity row. */
  const openCourse = COURSES[0];
  const openTopic = openCourse?.topics[Math.min(3, openCourse.topics.length - 1)];
  if (openCourse && openTopic) {
    const startedAt = new Date(now.getTime() - 42 * 60 * 1000);
    const heartbeatAt = new Date(now.getTime() - 11 * 60 * 1000);
    sessions.push({
      id: deterministicId('seed-session:open'),
      user_id: DEMO_USER_ID,
      course_id: openCourse.id,
      unit_id: openTopic.unitId,
      topic_id: openTopic.id,
      lesson_id: openTopic.lesson?.id ?? null,
      started_at: startedAt.toISOString(),
      ended_at: null,
      heartbeat_at: heartbeatAt.toISOString(),
      duration_seconds: 0,
      mode: 'lesson',
      notes: '',
      discarded: false,
      created_at: startedAt.toISOString(),
    });
  }

  // Derive topic progress from what the seed produced.
  for (const row of lessonDone) {
    const key = String(row.topic_id);
    const existing = topicProgress.get(key) ?? {
      user_id: DEMO_USER_ID,
      topic_id: key,
      course_id: row.course_id,
      lesson_done: false,
      lesson_done_at: null,
      practice_correct: 0,
      practice_total: 0,
      recent_correct: 0,
      recent_total: 0,
      status: 'not-started',
      self_rating: null,
      last_reviewed_at: null,
      updated_at: row.completed_at,
    };
    existing.lesson_done = true;
    existing.lesson_done_at = row.completed_at as string;
    existing.last_reviewed_at = row.completed_at as string;
    topicProgress.set(key, existing);
  }
  for (const attempt of attempts) {
    const key = String(attempt.topic_id);
    const existing = topicProgress.get(key) ?? {
      user_id: DEMO_USER_ID,
      topic_id: key,
      course_id: attempt.course_id,
      lesson_done: false,
      lesson_done_at: null,
      practice_correct: 0,
      practice_total: 0,
      recent_correct: 0,
      recent_total: 0,
      status: 'not-started',
      self_rating: null,
      last_reviewed_at: null,
      updated_at: attempt.created_at,
    };
    existing.practice_total += 1;
    existing.recent_total = Math.min(existing.recent_total + 1, 5);
    if (attempt.is_correct === true) {
      existing.practice_correct += 1;
      existing.recent_correct = Math.min(existing.recent_correct + 1, 5);
    }
    topicProgress.set(key, existing);
  }
  for (const tp of topicProgress.values()) {
    const acc = tp.practice_total ? tp.practice_correct / tp.practice_total : 0;
    const recent = tp.recent_total ? tp.recent_correct / tp.recent_total : 0;
    if (acc >= 0.85 && recent >= 0.8 && tp.practice_total >= 3) tp.status = 'mastered';
    else if (acc >= 0.7 && tp.practice_total >= 2) tp.status = 'strong';
    else if (tp.practice_total > 0) tp.status = 'practicing';
    else if (tp.lesson_done) tp.status = 'learning';
  }

  store.set('study_sessions', sessions);
  store.set('lesson_progress', lessonDone);
  store.set('practice_attempts', attempts);
  store.set('topic_progress', [...topicProgress.values()]);

  const stats = COURSES[0];
  const gov = COURSES[1];
  store.set('notes', [
    {
      id: deterministicId('seed-note-1'),
      user_id: DEMO_USER_ID,
      course_id: stats.id,
      unit_id: stats.units[2]?.id ?? null,
      topic_id: stats.units[2]?.topics[2]?.id ?? null,
      lesson_id: null,
      title: 'Confidence interval — the four steps',
      body:
        '**State** the parameter in context.\n**Plan** and check random / 10% / normality.\n**Do** the arithmetic.\n**Conclude** with "we are 95% confident the interval captures…".\n\nNever write "there is a 95% chance p is in the interval".',
      checklist: [
        { text: 'Re-do the bakery FRQ without looking', done: true },
        { text: 'Memorise z* for 90 / 95 / 99', done: true },
        { text: 'Practise two-proportion intervals', done: false },
      ],
      pinned: true,
      created_at: new Date(now.getTime() - 6 * 86400000).toISOString(),
      updated_at: new Date(now.getTime() - 2 * 86400000).toISOString(),
    },
    {
      id: deterministicId('seed-note-2'),
      user_id: DEMO_USER_ID,
      course_id: gov.id,
      unit_id: gov.units[0]?.id ?? null,
      topic_id: gov.units[0]?.topics[4]?.id ?? null,
      lesson_id: null,
      title: 'Federalist 51 vs Brutus 1 — one-line summaries',
      body:
        'F51: ambition must counteract ambition → structure beats promises.\nBrutus 1: necessary + proper + supremacy = consolidation.\n\nArgument essay move: name the tension, then pick a side.',
      checklist: [],
      pinned: false,
      created_at: new Date(now.getTime() - 11 * 86400000).toISOString(),
      updated_at: new Date(now.getTime() - 9 * 86400000).toISOString(),
    },
  ]);

  /* Pacing plans: one for the course being worked hardest, one further out.
   * Both are anchored to real exam dates so the schedule is meaningful. */
  store.set('study_pacing', [
    {
      user_id: DEMO_USER_ID,
      course_id: stats.id,
      start_date: new Date(now.getTime() - 42 * 86400000).toISOString().slice(0, 10),
      end_date: new Date(now.getTime() + 84 * 86400000).toISOString().slice(0, 10),
      weekly_minutes: 180,
      mode: 'calendar',
      created_at: new Date(now.getTime() - 42 * 86400000).toISOString(),
      updated_at: new Date(now.getTime() - 6 * 86400000).toISOString(),
    },
    {
      user_id: DEMO_USER_ID,
      course_id: gov.id,
      start_date: new Date(now.getTime() - 21 * 86400000).toISOString().slice(0, 10),
      end_date: new Date(now.getTime() + 126 * 86400000).toISOString().slice(0, 10),
      weekly_minutes: 120,
      mode: 'calendar',
      created_at: new Date(now.getTime() - 21 * 86400000).toISOString(),
      updated_at: new Date(now.getTime() - 21 * 86400000).toISOString(),
    },
  ]);

  store.set('study_plans', [
    {
      id: deterministicId('seed-plan-1'),
      user_id: DEMO_USER_ID,
      course_id: stats.id,
      unit_id: stats.units[1]?.id ?? null,
      kind: 'goal',
      title: 'Finish Unit 2 — Probability',
      target_date: new Date(now.getTime() + 18 * 86400000).toISOString().slice(0, 10),
      template: [],
      status: 'active',
      created_at: new Date(now.getTime() - 4 * 86400000).toISOString(),
      updated_at: new Date(now.getTime() - 4 * 86400000).toISOString(),
    },
    {
      id: deterministicId('seed-plan-2'),
      user_id: DEMO_USER_ID,
      course_id: gov.id,
      unit_id: null,
      kind: 'weekly',
      title: 'Weekday routine',
      target_date: null,
      template: [
        { day: 1, minutes: 45 },
        { day: 3, minutes: 30 },
        { day: 6, minutes: 60 },
      ],
      status: 'active',
      created_at: new Date(now.getTime() - 20 * 86400000).toISOString(),
      updated_at: new Date(now.getTime() - 20 * 86400000).toISOString(),
    },
  ]);

  return store;
}

/* ------------------------------------------------------------------ *
 * Global search for the demo backend (mirrors the SQL function).
 * ------------------------------------------------------------------ */

interface SearchRow {
  kind: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  rank: number;
}

function demoSearch(store: Map<string, Row[]>, query: string, limit: number): SearchRow[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hit = (text: string) => {
    const lower = text.toLowerCase();
    return terms.every((t) => lower.includes(t));
  };

  const out: SearchRow[] = [];
  for (const course of COURSES) {
    for (const unit of course.units) {
      for (const topic of unit.topics) {
        if (hit(`${topic.code} ${topic.title} ${topic.summary}`)) {
          out.push({
            kind: 'topic',
            id: topic.id,
            title: `${topic.code} · ${topic.title}`,
            subtitle: `${course.shortName} → Unit ${unit.code}`,
            href: `/courses/${course.slug}/topics/${topic.code}`,
            rank: 0.8,
          });
        }
        if (topic.lesson && hit(topic.lesson.title)) {
          out.push({
            kind: 'lesson',
            id: topic.lesson.id,
            title: topic.lesson.title,
            subtitle: `${course.shortName} → Topic ${topic.code}`,
            href: `/learn/${topic.lesson.id}`,
            rank: 0.6,
          });
        }
      }
    }
  }
  for (const note of store.get('notes') ?? []) {
    if (hit(`${note.title} ${note.body}`)) {
      out.push({
        kind: 'note',
        id: String(note.id),
        title: String(note.title),
        subtitle: 'Your notes',
        href: `/notes/${note.id}`,
        rank: 0.7,
      });
    }
  }
  return out.slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * Backend
 * ------------------------------------------------------------------ */

let cachedStore: Map<string, Row[]> | null = null;

function getStore(): Map<string, Row[]> {
  if (!cachedStore) cachedStore = seedTables();
  return cachedStore;
}

/** Test helper: rebuild the seed. */
export function resetDemoStore(): void {
  cachedStore = null;
}

class DemoTable implements TableApi {
  constructor(
    private store: Map<string, Row[]>,
    private table: string,
  ) {}

  select<T = Row>(): QueryBuilder<T> {
    return new DemoQuery<T>(this.store, this.table).select() as unknown as QueryBuilder<T>;
  }
  insert<T = Row>(rows: Row | Row[]): MutationBuilder<T> {
    const payload = Array.isArray(rows) ? rows : [rows];
    return new DemoQuery<T>(this.store, this.table).asInsert(payload, 'insert') as unknown as MutationBuilder<T>;
  }
  upsert<T = Row>(rows: Row | Row[], options?: { onConflict?: string }): MutationBuilder<T> {
    const payload = Array.isArray(rows) ? rows : [rows];
    return new DemoQuery<T>(this.store, this.table).asInsert(
      payload,
      'upsert',
      options?.onConflict,
    ) as unknown as MutationBuilder<T>;
  }
  update<T = Row>(values: Row): MutationBuilder<T> {
    return new DemoQuery<T>(this.store, this.table).asUpdate(values) as unknown as MutationBuilder<T>;
  }
  delete(): MutationBuilder<never> {
    return new DemoQuery<never>(this.store, this.table).asDelete() as unknown as MutationBuilder<never>;
  }
}

export const demoBackend: Backend = {
  kind: 'demo',
  async uid() {
    return DEMO_USER_ID;
  },
  from(table: string): TableApi {
    return new DemoTable(getStore(), table);
  },
  async rpc<T = Row>(fn: string, args?: Row): Promise<QueryResult<T[]>> {
    if (fn === 'global_search') {
      const rows = demoSearch(
        getStore(),
        String(args?.query ?? ''),
        Number(args?.max_rows ?? 24),
      );
      return { data: rows as unknown as T[], error: null };
    }
    if (fn === 'week_start') {
      const ts = new Date(String(args?.ts ?? Date.now()));
      const start = isoWeekStart(ts, Number(args?.week_start_day ?? 1));
      return { data: [start.toISOString().slice(0, 10)] as unknown as T[], error: null };
    }
    return { data: [] as T[], error: null };
  },
};

export const DEMO_LESSON_COUNT = LESSON_BY_ID.size;
export const DEMO_TOPIC_COUNT = ALL_TOPICS.length;
export type { Course };
