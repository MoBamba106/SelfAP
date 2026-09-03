-- ============================================================================
-- SelfAP — 0002_rls.sql
-- Row Level Security. Every table is locked down; nothing relies on the
-- client behaving. Assume an attacker holds a valid session for their own
-- account and is probing for somebody else's rows.
--
-- Invariants enforced here:
--   1. Any table with user_id → readable/writable ONLY by that user.
--   2. Curriculum tables → readable by signed-in students when published,
--      writable by admins only. There is no public write path at all.
--   3. The weekly_progress view runs as the invoker, so it inherits the
--      policies below instead of silently bypassing them.
--   4. The service role (server-side migrations/seeds) is unaffected because
--      it bypasses RLS by design and is never exposed to the browser.
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.courses             enable row level security;
alter table public.units               enable row level security;
alter table public.topics              enable row level security;
alter table public.lessons             enable row level security;
alter table public.lesson_videos       enable row level security;
alter table public.practice_questions  enable row level security;
alter table public.lesson_media        enable row level security;
alter table public.user_courses        enable row level security;
alter table public.weekly_goals        enable row level security;
alter table public.study_sessions      enable row level security;
alter table public.topic_progress      enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.practice_attempts   enable row level security;
alter table public.notes               enable row level security;
alter table public.study_plans         enable row level security;

-- ---------------------------------------------------------------------------
-- grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select on public.weekly_progress to authenticated;

grant select, insert, update on public.profiles           to authenticated;
grant select on public.courses, public.units, public.topics,
                 public.lessons, public.lesson_videos,
                 public.practice_questions, public.lesson_media to anon, authenticated;
grant insert, update, delete on public.courses, public.units, public.topics,
                 public.lessons, public.lesson_videos,
                 public.practice_questions, public.lesson_media to authenticated;
grant select, insert, update, delete on public.user_courses, public.weekly_goals,
                 public.study_sessions, public.topic_progress, public.lesson_progress,
                 public.practice_attempts, public.notes, public.study_plans to authenticated;

-- ---------------------------------------------------------------------------
-- profiles — your own row only
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());

-- An admin may look up another profile's public display name for the (future)
-- content tools. Role only — never email or preferences.
drop policy if exists "profiles: admin read" on public.profiles;
create policy "profiles: admin read" on public.profiles
  for select to authenticated using (public.is_admin());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  -- A student may never promote themselves.
  with check (id = auth.uid() and role = 'student');

-- Insert is deliberately omitted: rows come from the signup trigger, which
-- runs as a security-definer function.

-- ---------------------------------------------------------------------------
-- curriculum — published content for everyone signed in, admin-only writes
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['courses','units','topics','lessons','lesson_videos','practice_questions'] loop
    execute format('drop policy if exists "%s: read published" on public.%I', t, t);
    execute format(
      'create policy "%s: read published" on public.%I
         for select to authenticated
         using (published = true or public.is_admin())', t, t
    );
    execute format('drop policy if exists "%s: anon read published" on public.%I', t, t);
    execute format(
      'create policy "%s: anon read published" on public.%I
         for select to anon using (published = true)', t, t
    );
    execute format('drop policy if exists "%s: admin write" on public.%I', t, t);
    execute format(
      'create policy "%s: admin write" on public.%I
         for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t, t
    );
  end loop;
end $$;

drop policy if exists "lesson_media: read" on public.lesson_media;
create policy "lesson_media: read" on public.lesson_media
  for select to anon, authenticated using (true);

drop policy if exists "lesson_media: admin write" on public.lesson_media;
create policy "lesson_media: admin write" on public.lesson_media
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- student data — owner only, for every operation
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'user_courses','weekly_goals','study_sessions','topic_progress',
    'lesson_progress','practice_attempts','notes','study_plans'
  ] loop
    execute format('drop policy if exists "%s: owner all" on public.%I', t, t);
    execute format(
      'create policy "%s: owner all" on public.%I
         for all to authenticated
         using (user_id = auth.uid())
         with check (user_id = auth.uid())', t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- weekly_progress — inherit the policies of the tables underneath it.
-- Without this, a view owned by postgres would run with the owner's
-- privileges and expose every student's study time to every other student.
-- ---------------------------------------------------------------------------
alter view public.weekly_progress set (security_invoker = on);

-- ---------------------------------------------------------------------------
-- defence in depth: revoke everything from anon on student tables so a
-- mistake in a policy above cannot be reached anonymously.
-- ---------------------------------------------------------------------------
revoke all on public.user_courses, public.weekly_goals, public.study_sessions,
                public.topic_progress, public.lesson_progress,
                public.practice_attempts, public.notes, public.study_plans,
                public.profiles from anon;
