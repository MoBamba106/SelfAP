'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { markLessonComplete } from '@/lib/actions/study';
import { Button } from '@/components/ui/primitives';

/**
 * Completion button. The celebration is a single drawn tick and a colour
 * change — enough to feel earned, not enough to feel like a game.
 */
export function LessonActions({
  lessonId,
  alreadyComplete,
  nextHref,
}: {
  lessonId: string;
  alreadyComplete: boolean;
  nextHref: string | null;
}) {
  const [done, setDone] = useState(alreadyComplete);
  const [celebrate, setCelebrate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function complete() {
    setError(null);
    start(async () => {
      const result = await markLessonComplete(lessonId);
      if (!result.ok) {
        setError(result.message ?? 'Could not save that. Try again.');
        return;
      }
      setDone(true);
      setCelebrate(true);
      window.setTimeout(() => setCelebrate(false), 2400);
    });
  }

  return (
    <div className="mt-10 border-t border-linesoft pt-6">
      {done ? (
        <div
          className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--good)_35%,var(--line))] bg-[color-mix(in_srgb,var(--good)_10%,var(--paper-raised))] px-4 py-4"
          role="status"
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            aria-hidden="true"
            className={celebrate ? 'check-draw text-good' : 'text-good'}
            fill="none"
          >
            <path
              d="M4 12.5l5 5L20 6.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-sm font-semibold text-ink">
            Lesson complete{celebrate ? ' — nice work.' : '.'}
          </p>
          {nextHref ? (
            <Button href={nextHref} variant="primary" size="sm" className="ml-auto">
              Next lesson
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={complete} variant="primary" size="lg" disabled={pending}>
            <Check size={16} aria-hidden="true" />
            {pending ? 'Saving…' : 'Mark lesson complete'}
          </Button>
          {nextHref ? <Button href={nextHref}>Skip to next</Button> : null}
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
