import Link from 'next/link';
import { ArrowRight, CheckCircle2, Flame, NotebookPen, Sparkles } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import {
  getCourseRollups,
  getCourseWeeks,
  getRecentActivity,
  getRecommendation,
  getTotals,
  getEnrollments,
} from '@/lib/data/repository';
import { greetingFor, formatDuration, relativeTime } from '@/lib/utils/time';
import { courseTint } from '@/lib/utils/format';
import { WeeklyPanel } from '@/components/home/weekly-panel';
import { SuggestedNext } from '@/components/home/suggested-next';
import { Button, Card, CardBody, EmptyState, Stat } from '@/components/ui/primitives';

export const metadata = { title: 'Home' };

export default async function HomePage() {
  const user = await requireUser();
  const now = new Date();

  const [weeks, recommendation, rollups, activity, totals, enrollments] = await Promise.all([
    getCourseWeeks(user.id, now),
    getRecommendation(user.id),
    getCourseRollups(user.id),
    getRecentActivity(user.id, 6),
    getTotals(user.id, now),
    getEnrollments(user.id),
  ]);

  const name = user.profile?.displayName?.split(' ')[0];
  const continueCourse = weeks.find((w) => w.seconds > 0)?.course ?? weeks[0]?.course ?? null;

  if (!enrollments.length) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <p className="eyebrow mb-2">{greetingFor(now)}</p>
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Let&apos;s set up your workspace
        </h1>
        <p className="mt-3 text-base leading-relaxed text-inksoft">
          Pick the AP courses you are studying and set a weekly goal for each. SelfAP will
          build your curriculum map from there and start tracking from your first session.
        </p>
        <div className="mt-6">
          <Button href="/courses" variant="primary" size="lg">
            Choose your courses
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------ greeting */}
      <header className="anim-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">{greetingFor(now)}{name ? `, ${name}` : ''}</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-[40px] sm:leading-[1.1]">
            {totals.weekSeconds > 0 ? 'Keep the week moving' : 'Ready to study?'}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-inksoft">
            {totals.weekSeconds > 0
              ? `You have logged ${formatDuration(totals.weekSeconds)} this week across ${weeks.length} courses.`
              : 'Nothing logged yet this week. One session is enough to get the recommendations moving.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {continueCourse ? (
            <Button
              href={`/study?course=${continueCourse.slug}`}
              variant="primary"
              size="lg"
            >
              Continue {continueCourse.shortName}
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          ) : (
            <Button href="/study" variant="primary" size="lg">
              Start a session
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>

      {/* --------------------------------------------------------- stats */}
      <Card className="px-5 py-4">
        <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
          <Stat label="This week" value={formatDuration(totals.weekSeconds)} />
          <Stat
            label="Current streak"
            value={`${totals.streakDays}d`}
            hint={totals.streakDays > 0 ? 'consecutive days' : 'log a session to start one'}
          />
          <Stat label="Total time" value={formatDuration(totals.totalSeconds)} hint={`${totals.sessions} sessions`} />
          <Stat
            label="Topics mastered"
            value={
              [...rollups.values()].reduce((n, r) => n + r.masteryCounts.mastered, 0)
            }
            hint={`of ${enrollments.reduce((n, e) => n + e.course.topicCount, 0)} topics`}
          />
        </div>
      </Card>

      {/* ------------------------------------------------- main two cols */}
      <div className="grid items-start gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <WeeklyPanel weeks={weeks} />

          {/* course completion rail */}
          <Card>
            <div className="border-b border-linesoft px-4 py-3 sm:px-5">
              <p className="eyebrow mb-1">Your courses</p>
              <h2 className="font-display text-lg font-semibold text-ink">Curriculum progress</h2>
            </div>
            <ul className="divide-y divide-linesoft">
              {enrollments.map((enrollment, i) => {
                const rollup = rollups.get(enrollment.course.id);
                const completion = rollup?.completion ?? 0;
                return (
                  <li
                    key={enrollment.course.id}
                    className="anim-rise px-4 py-3 sm:px-5"
                    style={{ ...courseTint(enrollment.course.accent), animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <Link
                        href={`/courses/${enrollment.course.slug}`}
                        className="min-w-0 text-sm font-semibold text-ink underline-offset-4 hover:underline"
                      >
                        {enrollment.course.shortName}
                      </Link>
                      <span className="font-mono text-xs tabular-nums text-inksoft">
                        {completion}%
                      </span>
                    </div>
                    <div className="meter mt-2">
                      <span className="meter-fill" style={{ width: `${Math.min(100, completion)}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-inkfaint">
                      {rollup?.currentUnit
                        ? `Unit ${rollup.currentUnit.code} · ${rollup.currentUnit.done}/${rollup.currentUnit.total} topics`
                        : 'All units complete'}
                      {rollup && rollup.accuracy !== null
                        ? ` · ${Math.round(rollup.accuracy * 100)}% practice accuracy`
                        : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <SuggestedNext rec={recommendation} />

          {/* recent activity */}
          <Card>
            <div className="border-b border-linesoft px-4 py-3 sm:px-5">
              <p className="eyebrow mb-1">Recent activity</p>
              <h2 className="font-display text-lg font-semibold text-ink">What you did</h2>
            </div>
            <CardBody className="pt-2">
              {activity.length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  description="Finish a lesson or run a practice set and it will show up here."
                />
              ) : (
                <ul className="space-y-1">
                  {activity.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 py-2">
                      <span
                        aria-hidden="true"
                        className="mt-1 shrink-0"
                        style={{ color: `var(--t-${item.accent})` }}
                      >
                        {item.kind === 'lesson' ? (
                          <CheckCircle2 size={16} strokeWidth={1.9} />
                        ) : (
                          <NotebookPen size={16} strokeWidth={1.9} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                        <p className="truncate text-xs text-inkfaint">{item.subtitle}</p>
                      </div>
                      <time
                        dateTime={item.at}
                        className="shrink-0 text-[11px] tabular-nums text-inkghost"
                      >
                        {relativeTime(item.at)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* quick links */}
          <Card>
            <CardBody className="py-4">
              <p className="eyebrow mb-3">Jump to</p>
              <div className="flex flex-wrap gap-2">
                <Button href="/practice" size="sm">
                  <Sparkles size={14} aria-hidden="true" />
                  Practice
                </Button>
                <Button href="/progress" size="sm">
                  <Flame size={14} aria-hidden="true" />
                  Progress
                </Button>
                <Button href="/notes" size="sm">
                  <NotebookPen size={14} aria-hidden="true" />
                  Notes
                </Button>
                <Button href="/planner" size="sm">
                  Planner
                </Button>
                <Button href="/exam" size="sm">
                  Exam prep
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
