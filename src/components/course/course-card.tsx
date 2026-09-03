'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ArrowRight, Settings2 } from 'lucide-react';
import type { Course } from '@/content';
import type { CourseRollup } from '@/lib/data/repository';
import { changeWeeklyGoal, joinCourse, leaveCourse } from '@/lib/actions/workspace';
import { courseTint } from '@/lib/utils/format';
import { formatDuration, formatGoal } from '@/lib/utils/time';
import { Button, Meter } from '@/components/ui/primitives';
import { useRouter } from 'next/navigation';

const GOAL_PRESETS = [30, 60, 90, 120, 180, 240, 300];

/**
 * Course card with inline goal editing and enrolment. Updates are optimistic:
 * the bar moves immediately and the server call runs behind it.
 */
export function CourseCard({
  course,
  rollup,
  weeklyGoalMinutes,
  weekSeconds = 0,
}: {
  course: Course;
  rollup: CourseRollup | null;
  weeklyGoalMinutes: number;
  weekSeconds?: number;
}) {
  const router = useRouter();
  const [goal, setGoal] = useState(weeklyGoalMinutes);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  function saveGoal(minutes: number) {
    setGoal(minutes);
    start(async () => {
      await changeWeeklyGoal(course.id, minutes);
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      await leaveCourse(course.id);
      router.refresh();
    });
  }

  const completion = rollup?.completion ?? 0;

  return (
    <li className="card card-spine flex flex-col px-5 py-4" style={courseTint(course.accent)}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold leading-tight text-ink">
          {course.shortName}
        </h3>
        <span className="shrink-0 font-mono text-xs tabular-nums text-inkfaint">{completion}%</span>
      </div>
      <p className="mt-0.5 text-xs text-inkfaint">{course.code}</p>

      <div className="mt-3">
        <Meter value={completion} max={100} label={`${course.shortName} curriculum completion`} />
        <p className="mt-1.5 text-xs text-inkfaint">
          {rollup?.currentUnit
            ? `Unit ${rollup.currentUnit.code} · ${rollup.currentUnit.done}/${rollup.currentUnit.total} topics`
            : 'All units complete'}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-linesoft pt-3 text-sm">
        <div>
          <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">This week</dt>
          <dd className="mt-0.5 tabular-nums text-ink">
            {formatDuration(weekSeconds)}
            <span className="text-inkghost"> / {formatGoal(goal)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">Practice</dt>
          <dd className="mt-0.5 tabular-nums text-ink">
            {rollup?.accuracy !== null && rollup?.accuracy !== undefined
              ? `${Math.round(rollup.accuracy * 100)}%`
              : '—'}
            <span className="text-inkghost"> · {rollup?.practiceTotal ?? 0} tries</span>
          </dd>
        </div>
      </dl>

      {editing ? (
        <div className="mt-4 border-t border-linesoft pt-3">
          <p className="eyebrow mb-2">Weekly goal</p>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => saveGoal(minutes)}
                aria-pressed={goal === minutes}
                className={`btn btn-sm ${goal === minutes ? 'btn-primary' : ''}`}
              >
                {formatGoal(minutes)}
              </button>
            ))}
          </div>
          <label className="label mt-3" htmlFor={`custom-goal-${course.id}`}>
            Or set it in minutes
          </label>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const value = Number(new FormData(event.currentTarget).get('minutes'));
              if (Number.isFinite(value)) saveGoal(Math.min(4200, Math.max(0, Math.round(value))));
              setEditing(false);
            }}
          >
            <input
              id={`custom-goal-${course.id}`}
              name="minutes"
              type="number"
              min={0}
              max={4200}
              defaultValue={goal}
              className="input h-9 w-28 text-sm"
            />
            <Button type="submit" size="sm" variant="primary">
              Save
            </Button>
          </form>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-linesoft pt-3">
        <Link href={`/courses/${course.slug}`} className="btn btn-sm btn-primary">
          Open course
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="btn btn-sm"
          aria-expanded={editing}
          disabled={pending}
        >
          <Settings2 size={13} aria-hidden="true" />
          Goal
        </button>
        <button
          type="button"
          onClick={remove}
          className="btn btn-sm btn-quiet ml-auto"
          disabled={pending}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

/** Enrolment button used on the course detail page for courses not yet added. */
export function EnrolButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="primary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await joinCourse(slug, 120);
          router.refresh();
        })
      }
    >
      Add to my workspace
    </Button>
  );
}
