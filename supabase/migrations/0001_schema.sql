-- ============================================================================
-- SelfAP — 0001_schema.sql
-- Core relational schema. Idempotent: safe to re-run.
--
-- Design notes
--   * `auth.users` owns identity. `public.profiles` holds everything the app
--     needs about a person, created by trigger the moment they sign up.
--   * The curriculum (courses → units → topics → lessons → questions) is
--     global and read-only to students. It is NOT partitioned per user, so
--     adding a new AP subject is a row insert, not a schema change.
--   * Anything with a `user_id` column is private study data and gets a
--     matching RLS policy in 0002_rls.sql.
--   * Weekly progress is DERIVED from `study_sessions`. Nothing is ever
--     deleted when a week rolls over; see the `weekly_progress` view.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  display_name   text not null default '',
  timezone       text not null default 'UTC',
  -- 0 = Sunday … 6 = Saturday. Drives when weekly progress rolls over.
  week_start_day smallint not null default 1 check (week_start_day between 0 and 6),
  -- The May this student is sitting their AP exams (e.g. 2027).
  exam_year      smallint,
  -- Display name / study preferences / notification flags. Deliberately
  -- untyped jsonb so adding a setting is not a migration.
  preferences    jsonb not null default '{}'::jsonb,
  role           text not null default 'student' check (role in ('student', 'admin')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.profiles is
  'App-side mirror of auth.users. Never stores credentials or sensitive data.';

-- ---------------------------------------------------------------------------
-- curriculum: courses → units → topics → lessons → videos / questions
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  code                 text not null,                -- "AP Statistics"
  short_name           text not null,                -- "Statistics"
  tagline              text not null default '',
  description          text not null default '',
  -- math | english | social-studies | science | world-languages | arts
  subject              text not null default 'other',
  -- Key into the subject tint scale in globals.css (--t-stat, --t-gov, …)
  accent               text not null default 'stat',
  exam_date            date,
  exam_duration_minutes smallint,
  exam_summary         text not null default '',
  -- Course-specific tool ids, e.g. ["formula-sheet","case-briefs"].
  -- The app renders whatever tools a course declares; nothing is hard-coded
  -- to a particular AP subject.
  tools                jsonb not null default '[]'::jsonb,
  published            boolean not null default false,
  position             integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.units (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  code        text not null,
  title       text not null,
  summary     text not null default '',
  -- Verbatim exam-weighting band published by College Board, e.g. "15-23%".
  exam_weight text not null default '',
  position    integer not null default 0,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, code)
);

create table if not exists public.topics (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references public.units (id) on delete cascade,
  -- Denormalised so "everything about this course" is one indexed lookup.
  course_id  uuid not null references public.courses (id) on delete cascade,
  code       text not null,
  title      text not null,
  summary    text not null default '',
  key_ideas  jsonb not null default '[]'::jsonb,
  position   integer not null default 0,
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, code)
);

create table if not exists public.lessons (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references public.topics (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  title      text not null,
  summary    text not null default '',
  objectives jsonb not null default '[]'::jsonb,
  -- Ordered array of typed content blocks. Structured (rather than raw HTML)
  -- so it is safe to render, searchable, and editable from an admin UI.
  body       jsonb not null default '[]'::jsonb,
  vocabulary jsonb not null default '[]'::jsonb,
  formulas   jsonb not null default '[]'::jsonb,
  mistakes   jsonb not null default '[]'::jsonb,
  review     jsonb not null default '[]'::jsonb,
  -- Roughly how long the lesson takes, shown in the UI so students can plan.
  minutes    smallint not null default 10,
  published  boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A lesson may have several videos from several providers. Embeds are only
-- ever used where the provider explicitly permits it; `external_url` +
-- `embeddable = false` marks a resource the student must open themselves.
create table if not exists public.lesson_videos (
  id               uuid primary key default gen_random_uuid(),
  lesson_id        uuid not null references public.lessons (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete cascade,
  provider         text not null default 'youtube'
                   check (provider in ('youtube', 'vimeo', 'khan', 'selfap', 'external')),
  video_id         text not null default '',
  title            text not null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  thumbnail_url    text not null default '',
  external_url     text not null default '',
  embeddable       boolean not null default true,
  -- Who made it and under what licence. Surfaced in the UI under the player.
  attribution      text not null default '',
  position         integer not null default 0,
  published        boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists public.practice_questions (
  id                  uuid primary key default gen_random_uuid(),
  topic_id            uuid not null references public.topics (id) on delete cascade,
  course_id           uuid not null references public.courses (id) on delete cascade,
  kind                text not null default 'mcq'
                      check (kind in ('mcq', 'short-answer', 'frq', 'self-check')),
  prompt              text not null,
  -- mcq: ["choice a", "choice b", …]. Others: [] or a rubric.
  choices             jsonb not null default '[]'::jsonb,
  -- mcq: index. short-answer: {accepted:[...]}. frq: {rubric:"…"}.
  answer              jsonb not null,
  explanation         text not null default '',
  difficulty          smallint not null default 2 check (difficulty between 1 and 5),
  time_limit_seconds  integer not null default 0,
  -- True only for items written by SelfAP. Official College Board material is
  -- never reproduced here; it is linked as an external resource instead.
  original            boolean not null default true,
  source_note         text not null default '',
  position            integer not null default 0,
  published           boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- student data
-- ---------------------------------------------------------------------------
create table if not exists public.user_courses (
  user_id                  uuid not null references auth.users (id) on delete cascade,
  course_id                uuid not null references public.courses (id) on delete cascade,
  -- Default applied to every new week unless the student overrides it.
  default_weekly_minutes   integer not null default 120 check (default_weekly_minutes between 0 and 4200),
  active                   boolean not null default true,
  position                 integer not null default 0,
  enrolled_at              timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- A snapshot of the goal in force for a specific week. Written lazily the
-- first time a week is touched, so later goal changes never rewrite history.
create table if not exists public.weekly_goals (
  user_id    uuid not null references auth.users (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  -- Monday (or whichever day the student picked) at 00:00 in their timezone,
  -- normalised to a plain date.
  week_start date not null,
  minutes    integer not null default 120 check (minutes between 0 and 4200),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, week_start)
);

-- One row per timer run. This is the single source of truth for study time:
-- weekly totals, streaks and history are all aggregates over this table.
create table if not exists public.study_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete cascade,
  unit_id          uuid references public.units (id) on delete set null,
  topic_id         uuid references public.topics (id) on delete set null,
  lesson_id        uuid references public.lessons (id) on delete set null,
  started_at       timestamptz not null default now(),
  -- Null while the timer is running.
  ended_at         timestamptz,
  -- Written every 30s by the running timer. If the tab dies, the row
  -- already holds the last heartbeat, so at most one interval is lost.
  heartbeat_at     timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 28800),
  mode             text not null default 'focus'
                   check (mode in ('focus', 'lesson', 'practice', 'review')),
  notes            text not null default '' check (char_length(notes) <= 4000),
  -- Set when the student cancels, or when an orphaned session is swept.
  discarded        boolean not null default false,
  created_at       timestamptz not null default now()
);

comment on column public.study_sessions.duration_seconds is
  'Capped at 8h by constraint and at 4h by the auto-stop in the timer.';

-- Auto-stop guard: never let a row claim more than four hours in one go,
-- even if a client forgets to stop the timer.
create or replace function public.cap_session_duration()
returns trigger
language plpgsql
as $$
begin
  if new.ended_at is null then
    new.duration_seconds := 0;
  elsif new.heartbeat_at is null then
    new.heartbeat_at := new.ended_at;
  end if;
  new.duration_seconds := least(
    greatest(new.duration_seconds, 0),
    14400 -- 4 hours
  );
  return new;
end;
$$;

drop trigger if exists cap_session_duration on public.study_sessions;
create trigger cap_session_duration
  before insert or update on public.study_sessions
  for each row execute function public.cap_session_duration();

-- Per-topic mastery state. Derived by app logic from lesson completion +
-- practice accuracy + recency; never from time spent alone.
create table if not exists public.topic_progress (
  user_id            uuid not null references auth.users (id) on delete cascade,
  topic_id           uuid not null references public.topics (id) on delete cascade,
  course_id          uuid not null references public.courses (id) on delete cascade,
  lesson_done        boolean not null default false,
  lesson_done_at     timestamptz,
  practice_correct   integer not null default 0 check (practice_correct >= 0),
  practice_total     integer not null default 0 check (practice_total >= 0),
  -- Rolling accuracy over the student's most recent attempts on this topic.
  recent_correct     integer not null default 0 check (recent_correct >= 0),
  recent_total       integer not null default 0 check (recent_total >= 0),
  status             text not null default 'not-started'
                     check (status in ('not-started', 'learning', 'practicing', 'strong', 'mastered')),
  -- Optional 1-5 self rating. Advisory only, never enough on its own.
  self_rating        smallint check (self_rating between 1 and 5),
  last_reviewed_at   timestamptz,
  updated_at         timestamptz not null default now(),
  primary key (user_id, topic_id),
  check (practice_correct <= practice_total),
  check (recent_correct <= recent_total)
);

create table if not exists public.lesson_progress (
  user_id        uuid not null references auth.users (id) on delete cascade,
  lesson_id      uuid not null references public.lessons (id) on delete cascade,
  course_id      uuid not null references public.courses (id) on delete cascade,
  topic_id       uuid not null references public.topics (id) on delete cascade,
  completed_at   timestamptz,
  -- Video resume position, in seconds.
  video_position integer not null default 0 check (video_position >= 0),
  updated_at     timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.practice_attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  question_id        uuid not null references public.practice_questions (id) on delete cascade,
  topic_id           uuid not null references public.topics (id) on delete cascade,
  course_id          uuid not null references public.courses (id) on delete cascade,
  -- What the student chose/typed. Kept as jsonb so every question kind fits.
  answer             jsonb not null,
  is_correct         boolean,
  time_spent_seconds integer not null default 0 check (time_spent_seconds between 0 and 7200),
  -- Optional grouping id so a practice run can be reviewed as a unit.
  run_id             uuid,
  created_at         timestamptz not null default now()
);

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  course_id  uuid references public.courses (id) on delete cascade,
  unit_id    uuid references public.units (id) on delete set null,
  topic_id   uuid references public.topics (id) on delete set null,
  lesson_id  uuid references public.lessons (id) on delete set null,
  title      text not null default 'Untitled note' check (char_length(title) <= 160),
  -- A small, safe markdown subset. Rendered by our own parser, never eval'd.
  body       text not null default '' check (char_length(body) <= 20000),
  -- [{ text, done }]
  checklist  jsonb not null default '[]'::jsonb,
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  unit_id     uuid references public.units (id) on delete cascade,
  kind        text not null default 'goal' check (kind in ('goal', 'weekly')),
  title       text not null check (char_length(title) <= 160),
  target_date date,
  -- weekly plans only: [{ day: 0-6, minutes }]
  template    jsonb not null default '[]'::jsonb,
  status      text not null default 'active' check (status in ('active', 'done', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Diagrams / reference sheets we host ourselves, referenced by lessons.
create table if not exists public.lesson_media (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses (id) on delete cascade,
  lesson_id  uuid references public.lessons (id) on delete cascade,
  -- Path inside the `lesson-media` storage bucket.
  path       text not null,
  alt        text not null default '',
  caption    text not null default '',
  kind       text not null default 'diagram' check (kind in ('diagram', 'chart', 'document')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-create a profile row on signup so the app never has to.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','courses','units','topics','lessons','weekly_goals',
    'topic_progress','lesson_progress','notes','study_plans'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Week bucketing
--
-- Postgres' date_trunc('week', …) always starts on Monday. Students should be
-- able to pick their own week start, so we shift the timestamp into a
-- Monday-anchored frame, truncate, then shift back.
-- ---------------------------------------------------------------------------
create or replace function public.week_start(ts timestamptz, tz text, week_start_day smallint)
returns date
language sql
stable
as $$
  select (
    date_trunc(
      'week',
      (ts at time zone coalesce(nullif(tz, ''), 'UTC'))
        + (((8 - week_start_day) % 7) * interval '1 day')
    ) - (((8 - week_start_day) % 7) * interval '1 day')
  )::date;
$$;

comment on function public.week_start is
  'Start date of the study week containing ts, in the student''s timezone,
   honouring their chosen week start day (0 = Sunday).';

-- ---------------------------------------------------------------------------
-- weekly_progress — DERIVED, never written to
--
-- Study sessions are never deleted at a week boundary. The current week and
-- every past week are both just groupings of the same immutable rows.
-- ---------------------------------------------------------------------------
create or replace view public.weekly_progress as
select
  s.user_id,
  s.course_id,
  public.week_start(s.started_at, p.timezone, p.week_start_day) as week_start,
  coalesce(sum(s.duration_seconds), 0)::integer as seconds,
  count(*)::integer                             as sessions,
  coalesce(max(g.minutes), 0)::integer          as goal_minutes
from public.study_sessions s
join public.profiles p on p.id = s.user_id
left join public.weekly_goals g
  on g.user_id = s.user_id
 and g.course_id = s.course_id
 and g.week_start = public.week_start(s.started_at, p.timezone, p.week_start_day)
where s.discarded = false
  and s.ended_at is not null
group by 1, 2, 3;

comment on view public.weekly_progress is
  'Read-only rollup of study_sessions by (user, course, week). Current week
   and history live in the same place; a week reset is just a new bucket.';
