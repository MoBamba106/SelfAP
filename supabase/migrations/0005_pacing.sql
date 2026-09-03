-- ============================================================================
-- SelfAP — 0005_pacing.sql
-- Pacing: a per-course study schedule.
--
-- Only the *inputs* are stored here — where you started, when you are aiming
-- to finish, and how much time you have each week. The week-by-week
-- assignment of topics is derived at read time from the curriculum and your
-- actual progress, so it stays correct when content changes and needs no
-- backfill when a topic is added.
--
-- Idempotent: safe to re-run.
-- ============================================================================

create table if not exists public.study_pacing (
  user_id          uuid not null references auth.users (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete cascade,
  -- First day of the plan, in the student's own calendar.
  start_date       date not null,
  -- Aim to be finished by this date. Defaults to the course exam date when
  -- the student does not pick one.
  end_date         date not null,
  -- Minutes available per week. Drives how many topics land in a week when
  -- the student would rather pace by time than by calendar.
  weekly_minutes   smallint not null default 150 check (weekly_minutes between 0 and 4200),
  -- 'calendar' spreads topics evenly across the weeks available.
  -- 'time' packs weeks to the weekly budget and lets the finish date move.
  mode             text not null default 'calendar' check (mode in ('calendar', 'time')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- One pacing plan per student per course: a schedule is a decision, not a
  -- history. Re-planning replaces it; the study_sessions history is what
  -- records what actually happened.
  primary key (user_id, course_id),
  check (end_date >= start_date)
);

comment on table public.study_pacing is
  'Per-course pacing inputs. The schedule itself is derived, not stored.';

-- ---------------------------------------------------------------------------
-- grants + RLS. Same shape as the other student-owned tables.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.study_pacing to authenticated;
revoke all on public.study_pacing from anon;

alter table public.study_pacing enable row level security;

drop policy if exists "study_pacing: owner all" on public.study_pacing;
create policy "study_pacing: owner all" on public.study_pacing
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- updated_at, matching every other mutable table
-- ---------------------------------------------------------------------------
drop trigger if exists set_updated_at on public.study_pacing;
create trigger set_updated_at before update on public.study_pacing
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lookups: "my plan for this course" and "every plan I have"
-- ---------------------------------------------------------------------------
create index if not exists study_pacing_user_idx
  on public.study_pacing (user_id);
