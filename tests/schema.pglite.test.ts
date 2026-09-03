/**
 * The migrations, executed against a real Postgres.
 *
 * Everything else in this suite runs against the in-memory demo backend. That
 * proves the app logic but proves nothing about the SQL: a typo in a policy, a
 * missing `enable row level security`, or a view left running as its owner
 * would pass every other test here while silently leaking one student's data
 * to another in production.
 *
 * So this file boots Postgres in-process (PGlite, a WASM build of Postgres
 * with no native dependencies), applies every file in supabase/migrations in
 * filename order — the same files `npm run db:push` sends to Supabase — and
 * then checks the properties the security model actually rests on:
 *
 *   · every table has RLS enabled
 *   · the weekly_progress view runs as the invoker, so it inherits policies
 *   · global_search is not SECURITY DEFINER
 *   · a second student cannot read or write the first student's rows
 *   · a student cannot promote themselves, and cannot write curriculum
 *
 * Supabase provides a few things a bare Postgres does not have: the `auth`
 * schema, `auth.uid()`, the three roles, and the `storage` schema. The shim
 * below recreates the minimum of those so the migrations can run unchanged.
 * It recreates structure only — every policy under test comes from the
 * migration files, never from the shim.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — a plain-JS script with no type declarations
import { buildRows } from '../scripts/seed.mjs';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

const SHIM = `
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role nologin bypassrls;
    end if;
  end $$;

  create schema if not exists auth;

  -- Supabase lets every role resolve auth.uid(); the schema is not readable,
  -- only the function is executable.
  grant usage on schema auth to anon, authenticated, service_role;

  create table if not exists auth.users (
    id         uuid primary key default gen_random_uuid(),
    email      text,
    created_at timestamptz not null default now()
  );

  -- Supabase reads the subject out of the JWT in request.jwt.claims.
  create or replace function auth.uid()
  returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  $$;

  create schema if not exists storage;

  create table if not exists storage.buckets (
    id                 text primary key,
    name               text not null,
    public             boolean not null default false,
    file_size_limit    bigint,
    allowed_mime_types text[]
  );

  create table if not exists storage.objects (
    id         bigint generated always as identity primary key,
    bucket_id  text not null references storage.buckets (id),
    name       text not null,
    owner      uuid,
    created_at timestamptz not null default now()
  );

  -- Path segments of an object name, without the file name itself.
  create or replace function storage.foldername(name text)
  returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
  $$;

  -- Supabase grants these on the storage schema out of the box; the policies
  -- under test are the ones in 0004_storage.sql.
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;

  -- Supabase ships storage.objects with RLS on; without this the policies in
  -- 0004_storage.sql would be ignored and the test would prove nothing.
  alter table storage.objects enable row level security;
`;

const USER_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const USER_B = 'bbbbbbbb-0000-4000-8000-000000000002';

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function applyMigrations(db: PGlite): Promise<void> {
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
}

let db: PGlite;

/** Run as the table owner: bypasses RLS, the way a migration or seed does. */
async function asOwner(): Promise<void> {
  await db.exec('reset role');
  await db.exec(`select set_config('request.jwt.claims', '{}', false)`);
}

/** Run as a signed-in student, exactly as Supabase would present them. */
async function asUser(userId: string | null): Promise<void> {
  await db.exec('reset role');
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
  const claims = userId ? `{"sub":"${userId}","role":"authenticated"}` : '{}';
  await db.exec(`select set_config('request.jwt.claims', '${claims}', false)`);
}

/** Insert seed rows through the wire protocol, so Postgres does the casting. */
async function insertRows(table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const sql = `insert into public.${table} (${cols.map((c) => `"${c}"`).join(', ')})
               values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`;
  for (const row of rows) {
    const params = cols.map((c) => {
      const value = row[c];
      return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
    });
    await db.query(sql, params as unknown[]);
  }
}

beforeAll(async () => {
  // pgcrypto supplies gen_random_uuid(); Supabase has it enabled by default.
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SHIM);
  await applyMigrations(db);

  // Two accounts, created the way Supabase Auth would create them.
  await asOwner();
  for (const [id, email] of [
    [USER_A, 'ada@example.test'],
    [USER_B, 'grace@example.test'],
  ] as const) {
    await db.query('insert into auth.users (id, email) values ($1, $2) on conflict do nothing', [
      id,
      email,
    ]);
  }
  // A published course with one unit and one topic, so the student tables have
  // something valid to point at.
  await db.query(
    `insert into public.courses (id, slug, code, short_name, published)
     values ('00000000-0000-4000-8000-000000000c01', 'ap-test', 'AP Test', 'Test', true)
     on conflict (slug) do nothing`,
  );
  await db.query(
    `insert into public.units (id, course_id, code, title, position, published)
     values ('00000000-0000-4000-8000-0000000000b1',
             '00000000-0000-4000-8000-000000000c01', '1', 'Unit one', 0, true)
     on conflict do nothing`,
  );
  await db.query(
    `insert into public.topics (id, unit_id, course_id, code, title, position, published)
     values ('00000000-0000-4000-8000-0000000000d1',
             '00000000-0000-4000-8000-0000000000b1',
             '00000000-0000-4000-8000-000000000c01', '1.1', 'Sensation', 0, true)
     on conflict do nothing`,
  );
}, 120_000);

afterAll(async () => {
  await db?.close();
});

const COURSE = '00000000-0000-4000-8000-000000000c01';
const UNIT = '00000000-0000-4000-8000-0000000000b1';
const TOPIC = '00000000-0000-4000-8000-0000000000d1';

describe('migrations', () => {
  it('applies every file in filename order', () => {
    const files = migrationFiles();
    expect(files).toEqual([
      '0001_schema.sql',
      '0002_rls.sql',
      '0003_indexes.sql',
      '0004_storage.sql',
      '0005_pacing.sql',
    ]);
  });

  it('is idempotent — the whole set re-runs cleanly', async () => {
    await expect(applyMigrations(db)).resolves.not.toThrow();
  });

  it('creates seventeen public tables and one view', async () => {
    const tables = await db.query<{ c: number }>(
      `select count(*)::int as c from pg_tables where schemaname = 'public'`,
    );
    expect(tables.rows[0].c).toBe(17);

    const views = await db.query<{ c: number }>(
      `select count(*)::int as c from pg_views where schemaname = 'public'`,
    );
    expect(views.rows[0].c).toBe(1);
  });
});

describe('row level security', () => {
  it('is enabled on every public table', async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select c.relname
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('r', 'p')
          and not c.relrowsecurity
        order by 1`,
    );
    expect(rows).toEqual([]);
  });

  it('runs the weekly_progress view as the invoker so it inherits policies', async () => {
    const { rows } = await db.query<{ opts: string[] | null }>(
      `select reloptions as opts from pg_class where relname = 'weekly_progress'`,
    );
    expect(rows[0].opts ?? []).toContain('security_invoker=on');
  });

  it('does not make global_search SECURITY DEFINER', async () => {
    const { rows } = await db.query<{ prosecdef: boolean }>(
      `select prosecdef from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'global_search'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(false);
  });

  it('makes is_admin SECURITY DEFINER so a policy can read roles', async () => {
    const { rows } = await db.query<{ prosecdef: boolean }>(
      `select prosecdef from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'is_admin'`,
    );
    expect(rows[0].prosecdef).toBe(true);
  });

  it('hides one student\'s sessions from another', async () => {
    await asUser(USER_A);
    await db.query(
      `insert into public.study_sessions (user_id, course_id, unit_id, topic_id, mode, duration_seconds, ended_at)
       values ($1, $2, $3, $4, 'lesson', 600, now())`,
      [USER_A, COURSE, UNIT, TOPIC],
    );

    const own = await db.query<{ c: number }>(`select count(*)::int as c from public.study_sessions`);
    expect(own.rows[0].c).toBe(1);

    await asUser(USER_B);
    const theirs = await db.query<{ c: number }>(
      `select count(*)::int as c from public.study_sessions`,
    );
    expect(theirs.rows[0].c).toBe(0);
  });

  it('refuses to write a row belonging to another student', async () => {
    await asUser(USER_B);
    await expect(
      db.query(
        `insert into public.study_sessions (user_id, course_id, mode)
         values ($1, $2, 'focus')`,
        [USER_A, COURSE],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('isolates notes the same way', async () => {
    await asUser(USER_A);
    await db.query(
      `insert into public.notes (user_id, course_id, title, body)
       values ($1, $2, 'Weber''s law', 'Just-noticeable difference is a proportion.')`,
      [USER_A, COURSE],
    );

    await asUser(USER_B);
    const { rows } = await db.query<{ c: number }>(`select count(*)::int as c from public.notes`);
    expect(rows[0].c).toBe(0);
  });

  it('keeps global_search to the caller\'s own notes', async () => {
    await asUser(USER_B);
    const mine = await db.query<{ kind: string }>(
      `select kind from public.global_search('noticeable')`,
    );
    expect(mine.rows).toHaveLength(0);

    await asUser(USER_A);
    const theirs = await db.query<{ kind: string; title: string }>(
      `select kind, title from public.global_search('noticeable')`,
    );
    expect(theirs.rows.some((r) => r.kind === 'note' && r.title === "Weber's law")).toBe(true);
  });

  it('gives an anonymous visitor no access to student tables at all', async () => {
    await asUser(null);
    await expect(db.query(`select 1 from public.study_sessions`)).rejects.toThrow(
      /permission denied/i,
    );
  });

  it('shows curriculum only once it is published', async () => {
    await asOwner();
    await db.query(
      `insert into public.courses (id, slug, code, short_name, published)
       values ('00000000-0000-4000-8000-000000000c02', 'ap-draft', 'AP Draft', 'Draft', false)
       on conflict (slug) do update set published = false`,
    );

    await asUser(USER_A);
    const before = await db.query<{ c: number }>(
      `select count(*)::int as c from public.courses where slug = 'ap-draft'`,
    );
    expect(before.rows[0].c).toBe(0);

    await asOwner();
    await db.query(`update public.courses set published = true where slug = 'ap-draft'`);

    await asUser(USER_A);
    const after = await db.query<{ c: number }>(
      `select count(*)::int as c from public.courses where slug = 'ap-draft'`,
    );
    expect(after.rows[0].c).toBe(1);
  });

  it('stops a student promoting themselves to admin', async () => {
    await asUser(USER_A);
    await expect(
      db.query(`update public.profiles set role = 'admin' where id = $1`, [USER_A]),
    ).rejects.toThrow(/row-level security/i);

    // The rest of the row is still theirs to edit.
    await expect(
      db.query(`update public.profiles set display_name = 'Ada' where id = $1`, [USER_A]),
    ).resolves.not.toThrow();
  });

  it('stops a student writing curriculum', async () => {
    await asUser(USER_A);
    await expect(
      db.query(
        `insert into public.courses (slug, code, short_name) values ('ap-hack', 'AP Hack', 'Hack')`,
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('scopes note-files storage objects to a folder named after the owner', async () => {
    await asUser(USER_A);
    await expect(
      db.query(
        `insert into storage.objects (bucket_id, name, owner) values ('note-files', $1, $2)`,
        [`${USER_A}/diagram.png`, USER_A],
      ),
    ).resolves.not.toThrow();

    await expect(
      db.query(
        `insert into storage.objects (bucket_id, name, owner) values ('note-files', $1, $2)`,
        [`${USER_B}/sneaky.png`, USER_A],
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe('schema behaviour the app depends on', () => {
  it('creates a profile the moment an account signs up', async () => {
    // As owner: the row belongs to another student, and RLS would hide it.
    await asOwner();
    const { rows } = await db.query<{ display_name: string; role: string }>(
      `select display_name, role from public.profiles where id = $1`,
      [USER_B],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].display_name).toBe('grace');
    expect(rows[0].role).toBe('student');
  });

  it('caps a study session at four hours and zeroes a running one', async () => {
    await asOwner();
    const capped = await db.query<{ duration_seconds: number }>(
      `insert into public.study_sessions
         (user_id, course_id, mode, duration_seconds, started_at, ended_at)
       values ($1, $2, 'focus', 99999, now() - interval '9 hours', now())
       returning duration_seconds`,
      [USER_A, COURSE],
    );
    expect(capped.rows[0].duration_seconds).toBe(14400);

    const running = await db.query<{ duration_seconds: number; ended_at: string | null }>(
      `insert into public.study_sessions (user_id, course_id, mode, duration_seconds)
       values ($1, $2, 'focus', 500)
       returning duration_seconds, ended_at`,
      [USER_A, COURSE],
    );
    expect(running.rows[0].duration_seconds).toBe(0);
    expect(running.rows[0].ended_at).toBeNull();
  });

  it('backfills heartbeat_at when a session closes without one', async () => {
    await asOwner();
    const { rows } = await db.query<{ heartbeat_at: string | null }>(
      `insert into public.study_sessions
         (user_id, course_id, mode, duration_seconds, started_at, ended_at)
       values ($1, $2, 'focus', 120, now() - interval '2 minutes', now())
       returning heartbeat_at`,
      [USER_A, COURSE],
    );
    expect(rows[0].heartbeat_at).not.toBeNull();
  });

  it('rejects a pacing plan that ends before it starts', async () => {
    await asOwner();
    await expect(
      db.query(
        `insert into public.study_pacing (user_id, course_id, start_date, end_date)
         values ($1, $2, date '2027-01-01', date '2026-12-31')`,
        [USER_A, COURSE],
      ),
    ).rejects.toThrow(/study_pacing_check|check constraint/i);
  });

  it('anchors the study week to the student\'s chosen start day', async () => {
    const { rows } = await db.query<{ monday: string; sunday: string }>(
      `select
         public.week_start('2027-01-07 12:00:00+00'::timestamptz, 'UTC', 1::smallint)::text as monday,
         public.week_start('2027-01-07 12:00:00+00'::timestamptz, 'UTC', 0::smallint)::text as sunday`,
    );
    // 7 Jan 2027 is a Thursday.
    expect(rows[0].monday).toBe('2027-01-04');
    expect(rows[0].sunday).toBe('2027-01-03');
  });

  it('rolls a week over without deleting the weeks before it', async () => {
    await asOwner();
    // One closed session in each of the two weeks before the current one.
    await db.query(
      `insert into public.study_sessions
         (user_id, course_id, mode, duration_seconds, started_at, ended_at)
       values
         ($1, $2, 'lesson', 1800, date_trunc('week', now()) - interval '14 days',
                                            date_trunc('week', now()) - interval '14 days' + interval '30 minutes'),
         ($1, $2, 'lesson', 3600, date_trunc('week', now()) - interval '7 days',
                                            date_trunc('week', now()) - interval '7 days' + interval '60 minutes')`,
      [USER_A, COURSE],
    );

    const { rows } = await db.query<{ week_start: string; seconds: number }>(
      `select week_start::text as week_start, seconds
         from public.weekly_progress
        where user_id = $1 and course_id = $2
        order by week_start`,
      [USER_A, COURSE],
    );
    const buckets = rows.filter((r) => r.seconds > 0);
    expect(buckets.length).toBeGreaterThanOrEqual(2);
    expect(buckets[0].seconds).toBe(1800);
    expect(buckets[1].seconds).toBe(3600);
  });
});

/* --------------------------------------------------------------------------- *
 * The seed payload, against the schema.
 *
 * `npm run seed --dry-run` proves the JSON parses and the ids derive. It cannot
 * prove that what the script sends actually fits the tables: a renamed column,
 * a check constraint, or a missing foreign key would only surface when a real
 * Postgres rejects the insert. So the real course files are pushed through the
 * same buildRows() the script uses.
 * --------------------------------------------------------------------------- */
describe('seeded curriculum', () => {
  it('accepts every row scripts/seed.mjs would write', async () => {
    const files = readdirSync(join(process.cwd(), 'content', 'courses')).filter((f) =>
      f.endsWith('.json'),
    );
    expect(files.length).toBe(5);

    await asOwner();
    const totals = { courses: 0, units: 0, topics: 0, lessons: 0, lessonVideos: 0, questions: 0 };

    for (const file of files) {
      const raw = JSON.parse(
        readFileSync(join(process.cwd(), 'content', 'courses', file), 'utf8'),
      ) as Record<string, unknown>;
      const rows = buildRows(raw);
      // Foreign-key order, the same order the script pushes in.
      await insertRows('courses', rows.courses);
      await insertRows('units', rows.units);
      await insertRows('topics', rows.topics);
      await insertRows('lessons', rows.lessons);
      await insertRows('lesson_videos', rows.lessonVideos);
      await insertRows('practice_questions', rows.questions);
      totals.courses += rows.courses.length;
      totals.units += rows.units.length;
      totals.topics += rows.topics.length;
      totals.lessons += rows.lessons.length;
      totals.lessonVideos += rows.lessonVideos.length;
      totals.questions += rows.questions.length;
    }

    // Matches what `npm run seed -- --dry-run` reports for the same files.
    expect(totals.courses).toBe(5);
    expect(totals.units).toBe(33);
    expect(totals.topics).toBe(225);
    expect(totals.lessons).toBe(36);
    expect(totals.lessonVideos).toBe(1);
    expect(totals.questions).toBe(133);
  }, 120_000);

  it('makes the seeded curriculum readable by a signed-in student', async () => {
    await asUser(USER_A);
    const { rows } = await db.query<{ slug: string; topics: number }>(
      `select c.slug, count(t.id)::int as topics
         from public.courses c
         left join public.topics t on t.course_id = c.id
        where c.slug = 'ap-psychology'
        group by c.slug`,
    );
    expect(rows).toEqual([{ slug: 'ap-psychology', topics: 35 }]);
  });

  it('keeps an unpublished course invisible to the same student', async () => {
    await asOwner();
    await db.query(`update public.courses set published = false where slug = 'ap-psychology'`);

    await asUser(USER_A);
    const { rows } = await db.query<{ c: number }>(
      `select count(*)::int as c from public.courses where slug = 'ap-psychology'`,
    );
    expect(rows[0].c).toBe(0);
  });
});
