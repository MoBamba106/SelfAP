import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { courseTint } from '@/lib/utils/format';
import { formatDuration, formatGoal } from '@/lib/utils/time';
import type { CourseWeek } from '@/lib/data/repository';
import { Meter } from '@/components/ui/primitives';

const STATE_LABEL: Record<CourseWeek['state'], { text: string; tone: string }> = {
  'not-started': { text: 'Not started', tone: 'text-inkghost' },
  'in-progress': { text: 'In progress', tone: 'text-inkfaint' },
  reached: { text: 'Goal reached', tone: 'text-good' },
  exceeded: { text: 'Past your goal', tone: 'text-ochre' },
};

/** One row per enrolled course. Status is text + colour, never colour alone. */
export function WeeklyPanel({ weeks }: { weeks: CourseWeek[] }) {
  const totalSeconds = weeks.reduce((s, w) => s + w.seconds, 0);
  const totalGoal = weeks.reduce((s, w) => s + w.goalMinutes * 60, 0);
  const overall = totalGoal ? Math.min(999, Math.round((totalSeconds / totalGoal) * 100)) : 0;

  return (
    <section className="card" aria-labelledby="week-heading">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-linesoft px-4 py-3 sm:px-5">
        <div>
          <p className="eyebrow mb-1">This week</p>
          <h2 id="week-heading" className="font-display text-lg font-semibold text-ink">
            Study progress
          </h2>
        </div>
        <p className="text-sm tabular-nums text-inksoft">
          <span className="font-semibold text-ink">{formatDuration(totalSeconds)}</span>
          {totalGoal ? ` of ${formatGoal(Math.round(totalGoal / 60))} planned` : ' — no goals set'}
          {totalGoal ? (
            <span className="ml-1.5 text-inkfaint">({overall}%)</span>
          ) : null}
        </p>
      </header>

      <ul className="divide-y divide-linesoft">
        {weeks.map((week, index) => {
          const state = STATE_LABEL[week.state];
          const target = week.goalMinutes * 60;
          return (
            <li
              key={week.course.id}
              className="anim-rise px-4 py-3.5 sm:px-5"
              style={{ ...courseTint(week.course.accent), animationDelay: `${index * 45}ms` }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/courses/${week.course.slug}`}
                  className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink underline-offset-4 hover:underline"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: 'var(--tint)' }}
                  />
                  <span className="truncate">{week.course.shortName}</span>
                  <ArrowRight size={13} className="shrink-0 text-inkghost" aria-hidden="true" />
                </Link>
                <p className="shrink-0 font-mono text-xs tabular-nums text-inksoft">
                  {formatDuration(week.seconds)}
                  <span className="text-inkghost"> / {formatGoal(week.goalMinutes)}</span>
                </p>
              </div>

              <Meter
                className="mt-2"
                value={week.seconds}
                max={target || 1}
                state={week.state === 'reached' ? 'reached' : week.state === 'exceeded' ? 'exceeded' : 'in-progress'}
                label={`${week.course.shortName} weekly study progress`}
              />

              <div className="mt-1.5 flex items-center justify-between gap-3">
                <p className={`text-xs font-semibold ${state.tone}`}>
                  {target
                    ? `${Math.min(999, Math.round((week.seconds / target) * 100))}% of weekly goal`
                    : 'No goal set'}
                </p>
                <p className={`text-xs ${state.tone}`}>{state.text}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="border-t border-linesoft px-4 py-3 sm:px-5">
        <p className="text-xs leading-relaxed text-inkfaint">
          Weeks roll over on your chosen start day. Past sessions are kept — the bar simply
          starts a new bucket.{' '}
          <Link href="/settings" className="underline underline-offset-2 hover:text-accent">
            Change goals
          </Link>
        </p>
      </footer>
    </section>
  );
}
