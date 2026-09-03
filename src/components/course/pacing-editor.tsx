'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarRange, Check, Trash2, X } from 'lucide-react';
import { removePacingPlan, savePacingPlan } from '@/lib/actions/workspace';
import type { Pacing } from '@/lib/data/repository';
import { formatGoal } from '@/lib/utils/time';
import { Button, Card, CardBody, Field } from '@/components/ui/primitives';

/**
 * Pacing editor.
 *
 * Only three inputs are asked for — when you started, when you want to be
 * done, and how much time you realistically have each week. Everything the
 * schedule shows is derived from those and from the curriculum, so there is
 * nothing here to keep in sync by hand.
 */
export function PacingEditor({
  courseId,
  initial,
  examDate,
}: {
  courseId: string;
  initial: Pacing | null;
  examDate: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);

  const submit = (formData: FormData) => {
    start(async () => {
      setError(null);
      const res = await savePacingPlan({
        courseId,
        startDate: String(formData.get('startDate') ?? todayIso),
        endDate: String(formData.get('endDate') ?? examDate ?? todayIso),
        weeklyMinutes: Number(formData.get('weeklyMinutes') ?? 150),
        mode: String(formData.get('mode') ?? 'calendar') === 'time' ? 'time' : 'calendar',
      });
      if (!res.ok) {
        setError(res.message ?? 'Could not save the schedule.');
        return;
      }
      setOpen(false);
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 2500);
    });
  };

  const clear = () => {
    start(async () => {
      const res = await removePacingPlan(courseId);
      if (!res.ok) {
        setError(res.message ?? 'Could not remove the schedule.');
        return;
      }
      router.refresh();
    });
  };

  if (initial && !open) {
    return (
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3 py-4">
          <CalendarRange size={16} className="shrink-0 text-accent" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-inksoft">
            Scheduled{' '}
            <span className="font-semibold text-ink">{initial.startDate}</span> to{' '}
            <span className="font-semibold text-ink">{initial.endDate}</span> at{' '}
            <span className="font-semibold text-ink">
              {formatGoal(initial.weeklyMinutes)}
            </span>{' '}
            a week · {initial.mode === 'time' ? 'paced by time' : 'spread across the calendar'}
          </p>
          <Button size="sm" onClick={() => setOpen(true)} disabled={pending}>
            Adjust
          </Button>
          {saved ? (
            <span className="anim-pop flex items-center gap-1 text-xs font-medium text-good">
              <Check size={13} aria-hidden="true" /> Saved
            </span>
          ) : null}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="anim-rise">
      <div className="border-b border-linesoft px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">Pacing</p>
            <h2 className="font-display text-lg font-semibold text-ink">
              {initial ? 'Adjust the schedule' : 'Set up a schedule'}
            </h2>
          </div>
          {initial ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="no-tap-flash text-inkfaint hover:text-ink"
              aria-label="Close"
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      <CardBody>
        <form action={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" htmlFor="pace-start">
              <input
                id="pace-start"
                name="startDate"
                type="date"
                className="input"
                defaultValue={initial?.startDate ?? todayIso}
                required
              />
            </Field>
            <Field
              label="Finish by"
              htmlFor="pace-end"
              hint={examDate ? 'Pre-filled with the exam date.' : 'Aim to be finished by then.'}
            >
              <input
                id="pace-end"
                name="endDate"
                type="date"
                className="input"
                defaultValue={initial?.endDate ?? examDate ?? ''}
                required
              />
            </Field>
          </div>

          <Field
            label="Minutes a week"
            htmlFor="pace-minutes"
            hint="Be honest. A schedule you cannot keep is worse than none."
          >
            <input
              id="pace-minutes"
              name="weeklyMinutes"
              type="number"
              min={0}
              max={4200}
              step={15}
              className="input font-mono"
              defaultValue={initial?.weeklyMinutes ?? 150}
              required
            />
          </Field>

          <fieldset>
            <legend className="label mb-2">How to spread the work</legend>
            <div role="radiogroup" aria-label="Pacing mode" className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    id: 'calendar',
                    label: 'Even by calendar',
                    hint: 'Same amount every week, finishing on your date',
                  },
                  {
                    id: 'time',
                    label: 'Fill each week',
                    hint: 'Pack to your weekly budget; the finish date follows',
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-[6px] border border-line bg-paper2 px-3.5 py-3 transition-all duration-150 hover:border-accent/60 has-[:checked]:border-accent has-[:checked]:bg-tint-soft"
                >
                  <input
                    type="radio"
                    name="mode"
                    value={option.id}
                    defaultChecked={(initial?.mode ?? 'calendar') === option.id}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{option.label}</span>
                    <span className="block text-xs leading-relaxed text-inkfaint">
                      {option.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {error ? <p className="field-error">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Saving…' : initial ? 'Update schedule' : 'Build schedule'}
            </Button>
            {initial ? (
              <>
                <Button type="button" variant="quiet" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="ml-auto"
                  onClick={clear}
                  disabled={pending}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Remove
                </Button>
              </>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
