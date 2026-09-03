'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Check, Trash2, X } from 'lucide-react';
import { removePlan, saveStudyPlan } from '@/lib/actions/workspace';
import type { StudyPlan } from '@/lib/data/repository';
import { WEEKDAY_LABELS, formatDayLabel, parseIsoDate } from '@/lib/utils/time';
import { Button, Card, CardBody, Field } from '@/components/ui/primitives';

export type PlanCourseOption = { id: string; code: string; units: { id: string; code: string }[] };

const DEFAULT_TEMPLATE = [
  { day: 1, minutes: 45 },
  { day: 2, minutes: 0 },
  { day: 3, minutes: 45 },
  { day: 4, minutes: 0 },
  { day: 5, minutes: 45 },
  { day: 6, minutes: 90 },
  { day: 0, minutes: 60 },
];

export function PlanForm({ courses }: { courses: PlanCourseOption[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<'goal' | 'weekly'>('goal');
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!courses.length) {
    return (
      <p className="text-sm leading-relaxed text-inksoft">
        Add a course and you can plan against it.
      </p>
    );
  }

  const submit = (formData: FormData) => {
    start(async () => {
      setError(null);
      const courseId = String(formData.get('courseId') ?? courses[0]!.id);
      const course = courses.find((c) => c.id === courseId) ?? courses[0]!;
      const unitId = formData.get('unitId') ? String(formData.get('unitId')) : null;
      const template =
        kind === 'weekly'
          ? DEFAULT_TEMPLATE.map((slot) => ({
              day: slot.day,
              minutes: Number(formData.get(`day-${slot.day}`) ?? slot.minutes),
            }))
          : [];
      const res = await saveStudyPlan({
        courseId,
        unitId: unitId && course.units.some((u) => u.id === unitId) ? unitId : null,
        kind,
        title:
          String(formData.get('title') ?? '').trim() ||
          (kind === 'weekly' ? 'Weekly rhythm' : 'Finish the unit'),
        targetDate: kind === 'goal' ? (String(formData.get('targetDate') ?? '') || null) : null,
        template,
      });
      if (!res.ok) {
        setError(res.message ?? 'Could not save that plan.');
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus size={14} aria-hidden="true" />
        New plan
      </Button>
    );
  }

  return (
    <Card className="anim-rise">
      <div className="border-b border-linesoft px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-ink">New plan</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="no-tap-flash text-inkfaint hover:text-ink"
            aria-label="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <CardBody>
        <form action={submit} className="space-y-4">
          <div role="radiogroup" aria-label="Plan type" className="flex gap-1.5">
            {(
              [
                { id: 'goal', label: 'Dated goal', hint: 'Be somewhere by a date' },
                { id: 'weekly', label: 'Weekly rhythm', hint: 'Same shape every week' },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={kind === option.id}
                onClick={() => setKind(option.id)}
                className={`rounded-[4px] border px-3 py-2 text-left transition-all duration-120 ${
                  kind === option.id
                    ? 'border-accent bg-tint-soft'
                    : 'border-line bg-paper2 hover:border-accent/60'
                }`}
              >
                <span className="block text-sm font-semibold text-ink">{option.label}</span>
                <span className="block text-[11px] text-inkfaint">{option.hint}</span>
              </button>
            ))}
          </div>

          <Field label="Course" htmlFor="plan-course">
            <select id="plan-course" name="courseId" className="select" defaultValue={courses[0]!.id}>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Unit" htmlFor="plan-unit" hint="Optional — narrows the plan to one unit.">
            <select id="plan-unit" name="unitId" className="select" defaultValue="">
              <option value="">Whole course</option>
              {courses[0]!.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  Unit {unit.code}
                </option>
              ))}
            </select>
          </Field>

          {kind === 'goal' ? (
            <>
              <Field label="What are you trying to reach?" htmlFor="plan-title">
                <input
                  id="plan-title"
                  name="title"
                  className="input"
                  maxLength={160}
                  placeholder="Finish Unit 3 inference and clear the weak topics"
                />
              </Field>
              <Field label="By when" htmlFor="plan-date">
                <input id="plan-date" name="targetDate" type="date" className="input" />
              </Field>
            </>
          ) : (
            <>
              <Field label="What does a good week look like?" htmlFor="plan-title-weekly">
                <input
                  id="plan-title-weekly"
                  name="title"
                  className="input"
                  maxLength={160}
                  placeholder="Three weekday sittings plus a long Saturday block"
                />
              </Field>
              <fieldset>
                <legend className="label mb-2">Minutes per day</legend>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DEFAULT_TEMPLATE.map((slot) => (
                    <li key={slot.day}>
                      <label
                        className="mb-1 block font-mono text-[11px] text-inkfaint"
                        htmlFor={`plan-day-${slot.day}`}
                      >
                        {WEEKDAY_LABELS[slot.day]}
                      </label>
                      <input
                        id={`plan-day-${slot.day}`}
                        name={`day-${slot.day}`}
                        type="number"
                        min={0}
                        max={600}
                        step={15}
                        defaultValue={slot.minutes}
                        className="input h-9 font-mono text-sm"
                      />
                    </li>
                  ))}
                </ul>
              </fieldset>
            </>
          )}

          {error ? <p className="field-error">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Saving…' : 'Save plan'}
            </Button>
            <Button type="button" variant="quiet" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function PlanRow({ plan, courseCode }: { plan: StudyPlan; courseCode: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);

  const total = plan.template.reduce((sum, slot) => sum + slot.minutes, 0);

  return (
    <li
      className={`well px-4 py-3 transition-opacity ${gone ? 'pointer-events-none opacity-40' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="badge badge-accent">
              {plan.kind === 'weekly' ? 'weekly' : 'goal'}
            </span>
            <span className="font-mono text-[11px] text-inkghost">{courseCode}</span>
            {plan.status !== 'active' ? <span className="badge">{plan.status}</span> : null}
          </p>
          <p className="mt-1.5 text-sm font-semibold text-ink">{plan.title}</p>
          <p className="mt-0.5 text-xs text-inkfaint">
            {plan.kind === 'weekly'
              ? `${total} min a week across ${plan.template.filter((t) => t.minutes > 0).length} day${
                  plan.template.filter((t) => t.minutes > 0).length === 1 ? '' : 's'
                }`
              : plan.targetDate
                ? `Due ${formatDayLabel(parseIsoDate(plan.targetDate))}`
                : 'No date set'}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setGone(true);
              const res = await removePlan(plan.id);
              if (!res.ok) setGone(false);
              router.refresh();
            })
          }
          className="no-tap-flash shrink-0 rounded-[4px] p-1.5 text-inkghost transition-colors hover:bg-bad/10 hover:text-bad"
          aria-label={`Delete plan ${plan.title}`}
        >
          {gone ? <Check size={14} aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
        </button>
      </div>

      {plan.kind === 'weekly' && plan.template.length ? (
        <ul className="mt-2.5 flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const slot = plan.template.find((t) => t.day === day);
            const minutes = slot?.minutes ?? 0;
            return (
              <li
                key={day}
                title={`${WEEKDAY_LABELS[day]}: ${minutes} min`}
                className="rounded-[3px] border border-linesoft px-1.5 py-0.5 font-mono text-[10px]"
                style={{
                  background: minutes ? 'var(--accent-soft)' : 'transparent',
                  color: minutes ? 'var(--ink)' : 'var(--ink-ghost)',
                }}
              >
                {WEEKDAY_LABELS[day]} {minutes || '–'}
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
