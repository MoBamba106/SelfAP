-- ============================================================================
-- SelfAP — 0003_indexes.sql
-- Indexes for the queries the app actually runs. Each one is named after the
-- screen it exists to serve.
-- ============================================================================

-- Curriculum traversal -------------------------------------------------------
create index if not exists units_course_position_idx
  on public.units (course_id, position) where published = true;

create index if not exists topics_unit_position_idx
  on public.topics (unit_id, position) where published = true;

-- Course page loads every topic for a course in one shot.
create index if not exists topics_course_position_idx
  on public.topics (course_id, position) where published = true;

create index if not exists lessons_topic_position_idx
  on public.lessons (topic_id, position) where published = true;

create index if not exists lesson_videos_lesson_idx
  on public.lesson_videos (lesson_id, position) where published = true;

create index if not exists practice_questions_topic_idx
  on public.practice_questions (topic_id, position) where published = true;

-- Practice picker filters by course and kind.
create index if not exists practice_questions_course_kind_idx
  on public.practice_questions (course_id, kind) where published = true;

-- Dashboard: "this week, these courses" --------------------------------------
-- The single hottest query in the app.
create index if not exists study_sessions_user_started_idx
  on public.study_sessions (user_id, started_at desc)
  where discarded = false and ended_at is not null;

create index if not exists study_sessions_user_course_started_idx
  on public.study_sessions (user_id, course_id, started_at desc)
  where discarded = false and ended_at is not null;

-- Timer recovery on page load: find the open session for this user.
create index if not exists study_sessions_open_idx
  on public.study_sessions (user_id, started_at desc)
  where ended_at is null;

-- Course page "recent activity".
create index if not exists lesson_progress_user_recent_idx
  on public.lesson_progress (user_id, updated_at desc);

create index if not exists practice_attempts_user_recent_idx
  on public.practice_attempts (user_id, created_at desc);

-- Progress page accuracy rollups.
create index if not exists practice_attempts_course_idx
  on public.practice_attempts (user_id, course_id, created_at desc);
create index if not exists practice_attempts_topic_idx
  on public.practice_attempts (user_id, topic_id, created_at desc);

-- Weak-topic lists read straight from topic_progress.
create index if not exists topic_progress_user_course_idx
  on public.topic_progress (user_id, course_id);
create index if not exists topic_progress_user_status_idx
  on public.topic_progress (user_id, status);

-- Enrollment list.
create index if not exists user_courses_user_active_idx
  on public.user_courses (user_id, position) where active = true;

-- Goal lookup for a given week.
create index if not exists weekly_goals_user_week_idx
  on public.weekly_goals (user_id, week_start);

-- Notes ----------------------------------------------------------------------
create index if not exists notes_user_updated_idx
  on public.notes (user_id, updated_at desc);
create index if not exists notes_user_course_idx
  on public.notes (user_id, course_id);

-- Full-text search across notes. Generated column so the index stays in sync
-- without a trigger.
alter table public.notes
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored;

create index if not exists notes_search_idx
  on public.notes using gin (search_vector);

-- Curriculum search ----------------------------------------------------------
alter table public.topics
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(code, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B')
  ) stored;

create index if not exists topics_search_idx
  on public.topics using gin (search_vector);

alter table public.lessons
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B')
  ) stored;

create index if not exists lessons_search_idx
  on public.lessons using gin (search_vector);

-- Plans ----------------------------------------------------------------------
create index if not exists study_plans_user_active_idx
  on public.study_plans (user_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- global_search(text, uuid)
-- One round trip for the command palette. Returns at most `max_rows` hits
-- across curriculum and the caller's notes, tagged with where each came from.
-- ---------------------------------------------------------------------------
create or replace function public.global_search(query text, max_rows integer default 24)
returns table (
  kind        text,
  id          uuid,
  title       text,
  subtitle    text,
  href        text,
  rank        real
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select plainto_tsquery('english', coalesce(query, '')) as tsq
  )
  (
    select
      'topic'::text,
      t.id,
      t.code || ' · ' || t.title,
      c.short_name || ' → Unit ' || u.code,
      '/courses/' || c.slug || '/topics/' || t.code,
      ts_rank(t.search_vector, q.tsq) + 0.1
    from public.topics t
    join public.units u on u.id = t.unit_id
    join public.courses c on c.id = t.course_id
    cross join q
    where q.tsq @@ t.search_vector and t.published = true
    order by rank desc
    limit max_rows
  )
  union all
  (
    select
      'lesson'::text,
      l.id,
      l.title,
      c.short_name || ' → Topic ' || t.code,
      '/learn/' || l.id,
      ts_rank(l.search_vector, q.tsq)
    from public.lessons l
    join public.topics t on t.id = l.topic_id
    join public.courses c on c.id = l.course_id
    cross join q
    where q.tsq @@ l.search_vector and l.published = true
    order by rank desc
    limit max_rows
  )
  union all
  (
    select
      'note'::text,
      n.id,
      n.title,
      'Your notes',
      '/notes/' || n.id,
      ts_rank(n.search_vector, q.tsq) - 0.05
    from public.notes n
    cross join q
    where q.tsq @@ n.search_vector and n.user_id = auth.uid()
    order by rank desc
    limit max_rows
  )
  order by rank desc
  limit max_rows;
$$;

revoke all on function public.global_search(text, integer) from public;
grant execute on function public.global_search(text, integer) to authenticated;
