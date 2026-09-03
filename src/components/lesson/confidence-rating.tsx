'use client';

import { useState, useTransition } from 'react';
import { rateTopicConfidence } from '@/lib/actions/study';
import type { MasteryStatus } from '@/lib/utils/mastery';
import { MASTERY_LABEL } from '@/lib/utils/mastery';

const OPTIONS = [
  { value: 1, label: 'Shaky', tone: 'bad' },
  { value: 2, label: 'Uncertain', tone: 'warn' },
  { value: 3, label: 'Getting there', tone: 'ochre' },
  { value: 4, label: 'Confident', tone: 'accent' },
  { value: 5, label: 'Solid', tone: 'good' },
] as const;

/**
 * Optional self-assessment. It can hold a topic back but can never promote
 * one — mastery is earned by practice accuracy and recency, and the
 * component says so out loud.
 */
export function ConfidenceRating({
  topicId,
  initial,
  status,
  reasons,
}: {
  topicId: string;
  initial: number | null;
  status: MasteryStatus;
  reasons: string[];
}) {
  const [value, setValue] = useState<number | null>(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function rate(next: number) {
    const chosen = value === next ? null : next;
    setValue(chosen);
    setSaved(false);
    start(async () => {
      await rateTopicConfidence(topicId, chosen);
      setSaved(true);
    });
  }

  return (
    <section
      className="mt-8 rounded-[var(--radius-card)] border border-line bg-paper-sunk px-4 py-4"
      aria-labelledby="confidence-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="confidence-heading" className="font-display text-base font-semibold text-ink">
            How solid does this feel?
          </h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-inkfaint">
            Optional. A low rating can hold a topic back from &ldquo;strong&rdquo;; it can
            never move one up on its own — practice accuracy does that.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="eyebrow mb-1">Current status</p>
          <p className="text-sm font-semibold text-ink">{MASTERY_LABEL[status]}</p>
        </div>
      </div>

      <div
        className="mt-4 grid w-full max-w-xs grid-cols-5 gap-1"
        role="group"
        aria-label="Your confidence with this topic"
      >
        {OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => rate(option.value)}
              disabled={pending}
              aria-pressed={active}
              className="flex flex-col items-center gap-1 rounded-[6px] border px-1 py-2 text-[10.5px] font-semibold transition-colors"
              style={{
                borderColor: active ? `var(--${option.tone})` : 'var(--line-soft)',
                background: active ? `var(--${option.tone}-soft, var(--paper-raised))` : 'var(--paper-raised)',
                color: active ? `var(--${option.tone})` : 'var(--ink-faint)',
              }}
            >
              <span aria-hidden="true">{option.value}</span>
              <span className="leading-tight">{option.label}</span>
            </button>
          );
        })}
      </div>

      {reasons.length ? (
        <p className="mt-3 text-xs text-inkfaint">
          Based on {reasons.join('; ').toLowerCase()}.
        </p>
      ) : null}

      {saved ? (
        <p className="mt-2 text-xs font-semibold text-good" role="status">
          Saved.
        </p>
      ) : null}
    </section>
  );
}

