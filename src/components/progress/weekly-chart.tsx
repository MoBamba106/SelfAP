import type { WeekBucket } from '@/lib/data/repository';
import { formatDuration } from '@/lib/utils/time';

/**
 * Twelve weeks of logged study. Pure SVG, no chart library — the bars are the
 * data, nothing is smoothed, truncated or re-based.
 */
export function WeeklyChart({ weeks }: { weeks: WeekBucket[] }) {
  const ordered = weeks.slice().reverse(); // oldest → newest
  const max = Math.max(...ordered.map((w) => Math.max(w.seconds, w.goalMinutes * 60)), 1);

  if (ordered.every((w) => w.seconds === 0)) {
    return (
      <p className="py-6 text-center text-sm text-inkfaint">
        No logged study in the last twelve weeks yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[26rem]">
        <ul className="flex h-44 items-end gap-2" role="list">
          {ordered.map((week, i) => {
            const height = Math.max(2, (week.seconds / max) * 100);
            const goalHeight = week.goalMinutes ? ((week.goalMinutes * 60) / max) * 100 : null;
            const hit = goalHeight !== null && week.seconds >= week.goalMinutes * 60;
            const isCurrent = i === ordered.length - 1;
            return (
              <li key={week.weekStart} className="relative flex-1">
                <span className="sr-only">
                  Week of {week.label}: {formatDuration(week.seconds)} logged
                  {week.goalMinutes ? `, goal ${week.goalMinutes} minutes` : ''}
                </span>
                <div className="relative flex h-full items-end">
                  <div
                    aria-hidden="true"
                    className="w-full rounded-t-[3px] transition-[height] duration-500"
                    style={{
                      height: `${height}%`,
                      background: isCurrent ? 'var(--accent)' : hit ? 'var(--accent-soft)' : 'var(--rule)',
                      opacity: isCurrent ? 1 : 0.85,
                      boxShadow: 'inset 0 1px 0 rgb(255 255 255 / .25)',
                    }}
                  />
                  {goalHeight !== null ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ochre/60"
                      style={{ bottom: `${goalHeight}%` }}
                    />
                  ) : null}
                </div>
                <p
                  className={`mt-2 truncate text-center font-mono text-[10px] ${
                    isCurrent ? 'font-semibold text-ink' : 'text-inkghost'
                  }`}
                >
                  {isCurrent ? 'Now' : week.label.split(' ')[0]}
                </p>
                <p className="truncate text-center font-mono text-[10px] text-inkfaint">
                  {formatDuration(week.seconds)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-4 border-t border-linesoft pt-3 text-[11px] text-inkfaint">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-accent" /> Logged study
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-4 border-t-2 border-dashed border-ochre/70" />{' '}
          Weekly goal (all enrolled courses combined)
        </span>
      </p>
    </div>
  );
}
