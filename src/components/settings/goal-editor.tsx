'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { changeWeeklyGoal } from '@/lib/actions/workspace';
import { formatGoal } from '@/lib/utils/time';
import { Button } from '@/components/ui/primitives';

const PRESETS = [60, 90, 120, 180, 240, 300];

/** Inline weekly-goal editor. Optimistic, with a server-confirmed readback. */
export function GoalEditor({ courseId, initial }: { courseId: string; initial: number }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = (minutes: number) => {
    start(async () => {
      setError(null);
      const res = await changeWeeklyGoal(courseId, minutes);
      if (!res.ok) {
        setError(res.message ?? 'Could not save that goal.');
        return;
      }
      setValue(minutes);
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div>
      <div role="group" aria-label="Weekly study target" className="flex flex-wrap gap-1.5">
        {PRESETS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => commit(minutes)}
            disabled={pending}
            aria-pressed={value === minutes}
            className={`rounded-[4px] border px-2.5 py-1 font-mono text-xs transition-all duration-120 ${
              value === minutes
                ? 'border-accent bg-accent text-white'
                : 'border-line bg-paper2 text-inksoft hover:border-accent hover:text-accent'
            }`}
          >
            {formatGoal(minutes)}
          </button>
        ))}
      </div>
      <form
        className="mt-2.5 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const input = new FormData(event.currentTarget).get('minutes');
          commit(Number(input));
        }}
      >
        <label className="sr-only" htmlFor={`goal-${courseId}`}>
          Custom weekly target in minutes
        </label>
        <input
          id={`goal-${courseId}`}
          name="minutes"
          type="number"
          min={0}
          max={4200}
          step={15}
          className="input h-9 w-28 font-mono text-sm"
          defaultValue={value}
          disabled={pending}
        />
        <Button type="submit" size="sm" disabled={pending}>
          Set
        </Button>
        {saved ? (
          <span className="anim-pop flex items-center gap-1 text-xs font-medium text-good">
            <Check size={13} aria-hidden="true" /> Saved
          </span>
        ) : null}
      </form>
      {error ? <p className="field-error mt-1.5">{error}</p> : null}
    </div>
  );
}
