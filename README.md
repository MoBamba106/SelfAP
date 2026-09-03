# SelfAP

A study workspace for people sitting AP exams without a class behind them — homeschooled,
between schools, adding a subject the timetable would not fit, or retaking one.

SelfAP answers three questions and tries hard not to answer anything else:

1. **What should I study?** — a deterministic recommendation, with the reasons shown.
2. **How should I study it?** — the lesson, the practice, and a timer that survives a closed tab.
3. **Am I improving?** — mastery that moves on accuracy and recency, never on hours logged.

> **Not affiliated with the College Board.** SelfAP is an independent study tool. AP® and
> Advanced Placement® are registered trademarks of the College Board, which is not connected to
> SelfAP and does not review or endorse it. Every lesson and question here is original; official
> resources are linked to their publisher and labelled as external.

---

## Contents

- [Screenshots](#screenshots)
- [Features](#features)
- [Courses](#courses)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Demo mode](#demo-mode)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Adding a course](#adding-a-course)
- [Architecture](#architecture)
- [Security model](#security-model)
- [Scripts](#scripts)
- [Legal pages](#legal-pages)

---

## Screenshots

Screenshots live in [`docs/screenshots/`](docs/screenshots/). They are generated, not committed by
hand, so they cannot drift from the UI:

```bash
npm run screenshots   # needs a browser: npx playwright install chromium
```

That captures the dashboard, a course page, a lesson, a practice set, the pacing schedule,
progress and the mobile layout into `docs/screenshots/`.

| Screen | What it shows |
| --- | --- |
| Dashboard | This week per course, what to study next and why, recent activity |
| Course | Units and topics with mastery, exam info, weak areas, subject tools |
| Lesson | Objectives, explanation, worked examples, vocabulary, mistakes, quick review |
| Practice | Timed and untimed sets, instant explanations, links back to the lesson |
| Schedule | The whole course spread across weeks, this week's assignment, behind-by count |
| Progress | Overall and per course, plus twelve weeks of history |
| Mobile | The same app at 390px, with a thumb-reachable tab bar |

---

## Features

### Dashboard — "how am I doing this week"

Per-course weekly goals with progress bars that reset every week **without deleting anything**.
The reset is arithmetic: weekly progress is a read-only SQL view over `study_sessions`, filtered
to the current week. History is permanent, so last month is still last month.

### Study timer

Course → Unit → Topic picker, with start / pause / resume / stop / cancel.

- Heartbeats every 30 s, so a closed tab or a dead browser loses at most half a minute.
- A session that was never closed is reconstructed from its last heartbeat on the next visit and
  offered back to you.
- Auto-stops at four hours and hard-caps at eight (enforced by a database trigger, not just the
  client), so an abandoned tab cannot manufacture a heroic study day.
- Sessions under 30 s are discarded rather than deleted, which keeps the data auditable.

### Curriculum

Course → Unit → Topic → Lesson → Practice. Topics carry key ideas; lessons carry objectives, a
structured body, vocabulary, formulas, common mistakes and a quick review. Lesson bodies are typed
JSON blocks rendered by React — never `dangerouslySetInnerHTML`.

Topics without a fully written lesson get an honest outline flagged as such, rather than a page
that pretends to be finished.

### Video lessons

Embedded only where the publisher permits embedding, through a privacy-enhanced host, and only
after you press play. Your resume position is stored on your account. Anything that cannot
lawfully be embedded is linked out and labelled **external resource** — never downloaded,
mirrored or re-hosted.

### Practice

Multiple choice, short answer and free response. Timed or untimed, and filterable to weak areas or
questions you have never seen. MCQ and short answer are graded automatically; FRQs are graded by
you against the published rubric, because pretending to grade an essay would be worse than not
trying. Every answer shows its reasoning and links to the lesson that covers it.

### Mastery

`Not started → Learning → Practicing → Strong → Mastered`

- **Mastered** needs at least four attempts, 85% overall, and three of the most recent attempts at
  80% or better.
- **Strong** needs three attempts at 70%.
- Mastery **decays**: Mastered drops to Strong after 45 days without review.
- A self-rating can hold a topic back but can **never** promote one.

### Pacing schedules

Set a start date, a finish date and the minutes you realistically have each week. SelfAP spreads
the topics across the weeks, tells you what to do this week, and tells you how many topics you are
behind. Estimates come from lesson length plus practice time plus a 15% re-reading allowance —
they are planning figures, never confused with your measured time.

The schedule is **derived**, not stored: only your three inputs are saved, so the plan stays
correct when topics are added and needs no backfill.

### Progress

Overall and per course, with twelve weeks of history, mastery spread, accuracy, and the topics
that are weak against the ones holding well.

### Notes

Attached to a course, unit, topic or lesson, with checklists. They surface on the page they belong
to and are covered by global search.

### Search

Topics, lessons and your notes in one query, each result labelled with where it came from.

### Exam prep

Format, section weighting and free-response types for each exam, next to where you actually stand,
with links to the official documents.

### Subject tools

Declared per course in content, not hard-coded per subject: a statistics formula sheet, a
government reference of required cases and documents, suggested works for literature, FRQ prompt
banks. A new subject declares the tools it wants.

---

## Courses

| Course | Units | Topics | Written lessons |
| --- | --- | --- | --- |
| AP Statistics | 5 | 55 | 13 |
| AP US Government and Politics | 5 | 57 | 7 |
| AP English Language and Composition | 9 | 36 | 4 |
| AP English Literature and Composition | 9 | 42 | 3 |

AP Statistics follows the **redesigned** framework taking effect for the 2026–27 school year
(five units, first digital exam May 2027), not the older nine-unit outline.

---

## Tech stack

- **Next.js 16** App Router, React 19, TypeScript (strict)
- **Tailwind CSS 4** with a hand-written design system — no component library
- **Supabase** — Postgres, Auth, Storage, Row Level Security
- **Zod** for validating every server-action input
- Deployed on **Vercel**

Server Components by default. Client components exist only where state genuinely lives in the
browser: the timer, the practice runner, the video player, and the forms.

---

## Getting started

```bash
git clone https://github.com/MoBamba106/SelfAP.git
cd SelfAP
npm install
```

### 1. Create a Supabase project

At [supabase.com](https://supabase.com). Note the project URL and ref.

### 2. Apply the schema

```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxx      # from Account → Access Tokens
export SUPABASE_PROJECT_REF=abcdefghijkl  # from the project URL

npm run db:push              # applies supabase/migrations/*.sql in order
npm run db:push -- --dry-run # see the order first, write nothing
```

### 3. Seed the curriculum

```bash
export SUPABASE_URL=https://abcdefghijkl.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server-side only

npm run seed                 # upsert content/courses/*.json
npm run seed -- --dry-run    # parse and derive ids, write nothing
```

### 4. Configure the app

```bash
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open <http://localhost:3000>.

### 5. Deploy

Import the repository into Vercel and set the same environment variables. `next.config.ts`
already sends a Content-Security-Policy, `X-Frame-Options: DENY` and `X-Content-Type-Options:
nosniff`.

---

## Demo mode

Set `NEXT_PUBLIC_DEMO=1` and the app runs against a seeded in-memory store instead of Postgres —
a student with four courses, eight weeks of study history, practice attempts, notes and pacing
plans already in place. Useful for looking at the UI without provisioning anything.

```bash
NEXT_PUBLIC_DEMO=1 npm run dev
```

Demo mode is selected automatically whenever the Supabase variables are absent. It never touches
the network and never persists anything.

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Browser-safe key. RLS is what actually protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | seeding only | Bypasses RLS. **Never** expose to the browser |
| `NEXT_PUBLIC_SITE_URL` | recommended | Used for password-reset redirects |
| `NEXT_PUBLIC_DEMO` | no | `1` runs the in-memory demo store |

Anything prefixed `NEXT_PUBLIC_` is shipped to the browser. The service-role key never is, and
never appears in a client component.

---

## Database

Five migrations in `supabase/migrations/`, applied in filename order. All are idempotent.

| File | Contents |
| --- | --- |
| `0001_schema.sql` | Tables, the `weekly_progress` view, `week_start()`, the session-duration trigger |
| `0002_rls.sql` | Row Level Security and grants |
| `0003_indexes.sql` | Indexes for the hot paths |
| `0004_storage.sql` | `lesson-media` (public) and `note-files` (private) buckets |
| `0005_pacing.sql` | Pacing inputs |

Design points worth knowing:

- **`weekly_progress` is a view**, not a table, with `security_invoker = on`. Weekly progress
  cannot drift from the sessions it is computed from, and a week rolling over deletes nothing.
- **`study_sessions.duration_seconds`** is constrained to 0–28800 and clamped to 14400 by a
  trigger, so the ceiling holds even if the client lies.
- **Sessions are never hard-deleted** while a tab is open — they carry `ended_at IS NULL` plus a
  heartbeat, and a `discarded` flag rather than a delete.
- **Curriculum is global and read-only to students.** Adding a subject is a row insert, not a
  schema change.

---

## Adding a course

Drop a JSON file in `content/courses/` and seed. No schema change, no new route, no new component.

```jsonc
{
  "slug": "ap-biology",
  "code": "AP Biology",
  "shortName": "Biology",
  "tagline": "…",
  "description": "…",
  "subject": "science",
  "accent": "sci",            // key into the tint scale in globals.css
  "exam": { "date": "2027-05-11", "durationMinutes": 180, "sections": [], "frqs": [] },
  "tools": ["reference"],     // rendered generically by CourseTools
  "reference": [ { "group": "Formulas", "entries": [ { "term": "…", "expression": "…" } ] } ],
  "externalResources": [ { "label": "Official CED", "url": "https://…", "kind": "PDF" } ],
  "units": [
    {
      "code": "1",
      "title": "Chemistry of Life",
      "examWeight": "8-11%",
      "topics": [
        {
          "code": "1.1",                 // must start with the unit code
          "title": "…",
          "summary": "…",
          "keyIdeas": ["…"],
          "lesson": { "minutes": 12, "objectives": [], "body": [], "vocabulary": [], "formulas": [], "mistakes": [], "review": [], "videos": [] },
          "questions": [ { "kind": "mcq", "prompt": "…", "choices": [], "answer": 0, "explanation": "…", "difficulty": 2 } ]
        }
      ]
    }
  ]
}
```

Lesson `body` blocks are typed: `p`, `h`, `ul`, `ol`, `callout`, `formula`, `table`. Inline
formatting supports `**bold**`, `*italic*`, `` `code` `` and `[link](url)`.

The loader refuses a topic whose code is not prefixed with its unit's code, rather than guessing.

---

## Architecture

```
content/courses/*.json        the curriculum — single source of truth
shared/deterministic-id.js    id derivation, shared by app and seed script
supabase/migrations/          schema, RLS, indexes, storage, pacing
src/
  app/
    (site)/     marketing + legal
    (auth)/     sign in, sign up, password reset
    (app)/      the product: home, courses, study, practice, progress, planner, notes, exam
  components/   layout, ui primitives, and one folder per feature
  content/      loads and shapes the curriculum JSON
  lib/
    actions/    server actions (auth, study, workspace)
    auth/       session resolution
    data/       one query contract, two backends (Supabase / demo)
    pacing/     pure schedule derivation
    practice/   grading rules
    supabase/   clients
    utils/      time, formatting, mastery, rate limiting
scripts/        db-push, seed
```

### One contract, two backends

`src/lib/data/backend.ts` defines a small query interface — `eq`, `in`, `gte`, `order`, `limit`,
`maybeSingle`, `upsert`, and two RPCs. `backend-supabase.ts` implements it against `supabase-js`;
`backend-demo.ts` implements it against a seeded in-memory store. Everything above that layer is
written once and runs identically in both.

### Deterministic ids

`shared/deterministic-id.js` is plain JavaScript, outside `src/`, because both the TypeScript app
and `scripts/seed.mjs` must produce byte-identical ids from the same seed. If they ever disagreed,
every foreign key in the seeded database would be wrong. The seed strings live in the same file
for the same reason.

### Why there is no root `loading.tsx`

A root `loading.tsx` wraps every page in a Suspense boundary. The shell flushes with a `200`
before the page runs, so a `notFound()` thrown inside can no longer downgrade the status — missing
courses, topics, lessons and notes all returned `200` with the not-found UI. Correct status codes
matter more than a skeleton, so the file is deliberately absent.

---

## Security model

**Row Level Security is the boundary, not application code.**

- All 17 tables have RLS enabled. The 8 student-owned tables get a single `owner all` policy on
  `user_id = auth.uid()`.
- `anon` has no access to any student table — the grants are revoked explicitly.
- Curriculum is `select` for `anon` and `authenticated`; writes require an admin role that the
  student-facing app cannot reach or grant.
- The `weekly_progress` view uses `security_invoker = on`, so it cannot be used to see another
  user's rows.
- Every server action validates its input with Zod before it reaches the database.
- Passwords are never stored here — authentication is delegated to Supabase.
- Rate limits guard sign-in (10/min), sign-up (5/hr) and password reset (3/10min). Password reset
  always reports success, because revealing which addresses are registered is an enumeration leak.

`src/proxy.ts` redirects unauthenticated visitors to `/login`. It is a convenience. Removing it
would not expose a single row.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (flat config, Next 16 native) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest — 73 tests over mastery, grading, pacing, id derivation, the data layer, recommendations and search |
| `npm run db:push` | Apply `supabase/migrations/*.sql` via the Management API |
| `npm run seed` | Upsert `content/courses/*.json` via PostgREST |

Both database scripts accept `--dry-run`.

### Continuous integration

[`docs/ci.yml`](docs/ci.yml) is a ready GitHub Actions workflow: typecheck, lint, test and build
in one job, curriculum validation and migration ordering in another. It sits in `docs/` because
this repository's automation token lacks the `workflows` scope, so GitHub rejects pushes that
create files under `.github/workflows/`. Move it into place to turn it on:

```bash
mkdir -p .github/workflows && mv docs/ci.yml .github/workflows/ci.yml
```

### Tests

`npm run test` covers the logic that would be expensive to get wrong and is cheap to verify:

- **`src/lib/utils/mastery.test.ts`** — mastery is earned on accuracy and recency, never on hours
  logged; a high self-rating cannot promote a topic; a low one can hold it back; staleness demotes
  Mastered to Strong.
- **`src/lib/practice/grading.test.ts`** — MCQ matches an index (including the string form that
  arrives from a form); short answer accepts any listed term; FRQ is never auto-graded; and an
  unanswered question returns `null` rather than being marked wrong.
- **`src/lib/pacing/schedule.test.ts`** — every topic is scheduled exactly once, the plan is
  deterministic, calendar mode balances the load, time mode respects the weekly budget, and
  behind-by counts topics that should already be done.
- **`tests/deterministic-id.test.ts`** — pins the exact id values, because the app and
  `scripts/seed.mjs` must agree byte-for-byte or every seeded foreign key breaks.

---

## Legal pages

`/privacy`, `/terms`, `/dmca`, `/about` and `/contact`.

**These are working templates, not legal advice.** Each page says so at the top. Have them
reviewed by a qualified attorney in your jurisdiction before relying on them commercially. The
contact address is a placeholder — point it at your own inbox before deploying.

---

## Licence

MIT. Curriculum content is original to SelfAP and is not derived from College Board materials or
from any textbook.
