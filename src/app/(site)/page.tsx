import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, BookOpen, Compass, Gauge, Timer } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { backendKind } from '@/lib/supabase/env';
import { COURSES } from '@/content';
import { courseTint } from '@/lib/utils/format';
import { Button } from '@/components/ui/primitives';

export const metadata = {
  title: 'Your independent AP study workspace',
};

const PILLARS = [
  {
    icon: Compass,
    title: 'What should I study?',
    body: 'A deterministic recommendation reads your curriculum position and your recent practice, then names the next topic and says why. No black box.',
  },
  {
    icon: BookOpen,
    title: 'How should I study it?',
    body: 'Every topic has a real lesson inside the app — objectives, worked examples, formulas, common mistakes and a quick review — plus practice that follows.',
  },
  {
    icon: Gauge,
    title: 'Am I actually improving?',
    body: 'Study time, weekly goals, topic mastery and practice accuracy, tracked from the same session data. History is never deleted when a week resets.',
  },
];

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) redirect('/home');
  const demo = backendKind() === 'demo';

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
          <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div className="anim-rise">
              <p className="eyebrow mb-4">Built for the student studying alone</p>
              <h1 className="font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
                Self-studying an AP course
                <span className="text-accent"> shouldn&apos;t feel improvised.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-inksoft">
                SelfAP puts the whole framework in front of you — every unit, every topic, a
                lesson for each — then keeps honest score of the hours you actually put in and
                what you actually got right.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button href="/signup" variant="primary" size="lg">
                  Create your workspace
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
                {demo ? (
                  <Button href="/login" size="lg">
                    Try the demo
                  </Button>
                ) : (
                  <Button href="/login" size="lg">
                    Sign in
                  </Button>
                )}
              </div>

              <p className="mt-5 text-xs text-inkfaint">
                Free. Your study data is yours, exportable, and isolated from every other
                student by database-level row security.
              </p>
            </div>

            {/* A quiet, real-looking dashboard fragment rather than a mockup. */}
            <div className="anim-rise card overflow-hidden" style={{ animationDelay: '120ms' }}>
              <div className="border-b border-linesoft px-5 py-3">
                <p className="eyebrow">This week</p>
              </div>
              <ul className="divide-y divide-linesoft">
                {COURSES.map((course, i) => {
                  const pct = [68, 62, 43, 76][i % 4];
                  return (
                    <li key={course.slug} className="px-5 py-3.5" style={courseTint(course.accent)}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex items-center gap-2 truncate text-sm font-semibold text-ink">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: 'var(--tint)' }}
                          />
                          {course.shortName}
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-inkfaint">
                          {pct}%
                        </span>
                      </div>
                      <div className="meter mt-2">
                        <span className="meter-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- pillars */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="eyebrow mb-2">Three questions, always answered</p>
        <h2 className="font-display text-3xl font-semibold text-ink">
          A tool, not a dashboard
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PILLARS.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.title}
                className="card px-5 py-5 anim-rise"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <Icon size={20} strokeWidth={1.8} className="text-accent" aria-hidden="true" />
                <h3 className="mt-3 font-display text-lg font-semibold text-ink">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-inksoft">{pillar.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------- courses */}
      <section className="border-y border-line bg-paper-raised/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">Ships with</p>
              <h2 className="font-display text-3xl font-semibold text-ink">
                Four courses, {COURSES.reduce((n, c) => n + c.topicCount, 0)} topics
              </h2>
            </div>
            <p className="max-w-sm text-sm text-inksoft">
              Structure follows the published AP course frameworks. Adding a subject is a
              content file, not a rebuild.
            </p>
          </div>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {COURSES.map((course) => (
              <li key={course.slug} className="card card-spine px-5 py-4" style={courseTint(course.accent)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-semibold text-ink">{course.code}</p>
                    <p className="mt-1 text-sm leading-relaxed text-inksoft">{course.tagline}</p>
                  </div>
                  <span className="badge shrink-0">{course.topicCount} topics</span>
                </div>
                <dl className="mt-4 flex gap-6 border-t border-linesoft pt-3 text-xs">
                  <div>
                    <dt className="text-inkghost">Units</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-ink">{course.units.length}</dd>
                  </div>
                  <div>
                    <dt className="text-inkghost">Written lessons</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-ink">{course.lessonCount}</dd>
                  </div>
                  <div>
                    <dt className="text-inkghost">Exam</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                      {course.exam.durationMinutes ? `${Math.round(course.exam.durationMinutes / 60 * 10) / 10}h` : '—'}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------- cta */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <div className="flex justify-center">
          <Timer size={22} strokeWidth={1.8} className="text-accent" aria-hidden="true" />
        </div>
        <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-4xl">
          Start studying in under ten seconds
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-inksoft">
          Pick a course, pick a topic, start the timer. SelfAP records the session, updates
          your week, and moves the recommendation forward.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button href="/signup" variant="primary" size="lg">
            Create your workspace
          </Button>
        </div>
        <p className="mt-6 text-xs text-inkfaint">
          <Link href="/about" className="underline underline-offset-4 hover:text-accent">
            How SelfAP handles content and copyright
          </Link>
        </p>
      </section>
    </>
  );
}
