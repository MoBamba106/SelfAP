'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import type { PracticeQuestion } from '@/content';
import { submitAnswer } from '@/lib/actions/workspace';
import { cn } from '@/lib/utils/format';
import { Button } from '@/components/ui/primitives';
import { RichText } from '@/components/lesson/rich-text';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

type Outcome = 'correct' | 'incorrect' | 'self-graded' | null;

/**
 * One question, one card. Answering reveals the explanation, the topic it
 * belongs to, and an explicit way to try again.
 */
export function QuestionRunner({
  question,
  topicLabel,
  topicHref,
  runId,
  compact,
}: {
  question: PracticeQuestion;
  topicLabel?: string;
  topicHref?: string;
  runId?: string;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [graded, setGraded] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Set in an effect, not during render: reading the clock while rendering is
   * impure, and `elapsed()` is only ever called from an event handler, which
   * always runs after mount. */
  const startedAt = useRef(0);
  const headingId = `q-${question.id}`;

  useEffect(() => {
    startedAt.current = Date.now();
  }, [question.id]);

  const elapsed = () =>
    startedAt.current
      ? Math.min(7200, Math.round((Date.now() - startedAt.current) / 1000))
      : 0;

  /**
   * `selfGrade` is set only by the FRQ self-assessment buttons. For every
   * other kind the grade comes from the server-side key, never from the
   * client.
   */
  async function send(answer: unknown, selfGrade?: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await submitAnswer({
        questionId: question.id,
        answer,
        timeSpentSeconds: elapsed(),
        runId: runId ?? null,
        selfGrade,
      });
      if (!result.ok) setError(result.message ?? 'Could not record that answer.');
      const grade = selfGrade === undefined ? (result.data?.correct ?? null) : selfGrade;
      setGraded(grade);
      setOutcome(grade === true ? 'correct' : grade === false ? 'incorrect' : 'self-graded');
    } catch {
      setError('Network problem — your answer was not recorded.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSelected(null);
    setTyped('');
    setOutcome(null);
    setGraded(null);
    setError(null);
    startedAt.current = Date.now();
  }

  const answered = outcome !== null;

  return (
    <article className="card px-4 py-4 sm:px-5" aria-labelledby={headingId}>
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="badge">{question.kind === 'mcq' ? 'Multiple choice' : question.kind === 'frq' ? 'Free response' : 'Short answer'}</span>
        {topicLabel ? (
          topicHref ? (
            <a href={topicHref} className="badge badge-accent no-underline">
              {topicLabel}
            </a>
          ) : (
            <span className="badge badge-accent">{topicLabel}</span>
          )
        ) : null}
        <span className="badge ml-auto">Difficulty {question.difficulty}/5</span>
      </header>

      <h3 id={headingId} className={cn('font-display font-semibold leading-snug text-ink', compact ? 'text-base' : 'text-lg')}>
        <RichText text={question.prompt} />
      </h3>

      {/* ------------------------------------------------------- mcq */}
      {question.kind === 'mcq' ? (
        <fieldset className="mt-4 border-0 p-0" disabled={answered}>
          <legend className="sr-only">Choose one answer</legend>
          <ul className="space-y-2">
            {question.choices.map((choice, index) => {
              const isAnswer = Number(question.answer) === index;
              const state = !answered
                ? selected === index
                  ? 'selected'
                  : 'idle'
                : isAnswer
                  ? 'correct'
                  : selected === index
                    ? 'wrong'
                    : 'muted';
              return (
                <li key={index}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-[var(--radius-ctl)] border px-3 py-2.5 text-sm leading-relaxed transition-colors',
                      state === 'selected' && 'border-accent bg-accentsoft',
                      state === 'correct' && 'border-good bg-[color-mix(in_srgb,var(--good)_10%,var(--paper-raised))]',
                      state === 'wrong' && 'border-bad bg-[color-mix(in_srgb,var(--bad)_10%,var(--paper-raised))]',
                      state === 'muted' && 'border-linesoft opacity-70',
                      state === 'idle' && 'border-line bg-paper-raised hover:border-linestrong',
                    )}
                  >
                    <input
                      type="radio"
                      name={headingId}
                      className="sr-only"
                      checked={selected === index}
                      onChange={() => setSelected(index)}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-px grid h-5 w-5 shrink-0 place-items-center rounded-[4px] border text-[11px] font-bold',
                        state === 'correct' && 'border-good bg-good text-white',
                        state === 'wrong' && 'border-bad bg-bad text-white',
                        state === 'selected' && 'border-accent bg-accent text-white',
                        (state === 'idle' || state === 'muted') && 'border-line bg-paper-soft text-inkfaint',
                      )}
                    >
                      {LETTERS[index] ?? index + 1}
                    </span>
                    <span className="text-ink">
                      <RichText text={choice} />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}

      {/* ------------------------------------------------ short answer */}
      {question.kind === 'short-answer' ? (
        <div className="mt-4">
          <label className="sr-only" htmlFor={`${headingId}-answer`}>
            Your answer
          </label>
          <textarea
            id={`${headingId}-answer`}
            className="textarea"
            rows={3}
            value={typed}
            disabled={answered}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Write your answer…"
          />
        </div>
      ) : null}

      {/* --------------------------------------------------------- frq */}
      {question.kind === 'frq' ? (
        <div className="mt-4">
          <label className="sr-only" htmlFor={`${headingId}-frq`}>
            Your response
          </label>
          <textarea
            id={`${headingId}-frq`}
            className="textarea"
            rows={6}
            value={typed}
            disabled={answered}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Plan your response, then compare it with the rubric below…"
          />
          <p className="hint">
            Free response is not auto-graded. Write your answer, then mark yourself against
            the rubric honestly — that self-mark is what feeds your mastery estimate.
          </p>
        </div>
      ) : null}

      {/* ------------------------------------------------- submit row */}
      {!answered ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={busy || (question.kind === 'mcq' ? selected === null : typed.trim().length === 0)}
            onClick={() => send(question.kind === 'mcq' ? selected : typed)}
          >
            {busy ? 'Checking…' : question.kind === 'frq' ? 'Show rubric' : 'Check answer'}
          </Button>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ----------------------------------------------- feedback */}
      {answered ? (
        <div className="anim-pop mt-4 space-y-3">
          {question.kind === 'frq' ? (
            <div className="well px-4 py-3">
              <p className="eyebrow mb-2">Rubric</p>
              <ul className="space-y-1.5">
                {((question.answer as { rubric?: string[] })?.rubric ?? []).map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-inksoft">
                    <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ochre" />
                    <RichText text={line} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            className={cn(
              'rounded-[var(--radius-ctl)] border px-4 py-3',
              graded === true && 'border-[color-mix(in_srgb,var(--good)_35%,var(--line))] bg-[color-mix(in_srgb,var(--good)_10%,var(--paper-raised))]',
              graded === false && 'border-[color-mix(in_srgb,var(--bad)_35%,var(--line))] bg-[color-mix(in_srgb,var(--bad)_10%,var(--paper-raised))]',
              graded === null && 'border-line bg-paper-sunk',
            )}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              {graded === true ? (
                <>
                  <CheckCircle2 size={16} className="text-good" aria-hidden="true" />
                  Correct
                </>
              ) : graded === false ? (
                <>
                  <XCircle size={16} className="text-bad" aria-hidden="true" />
                  Not quite
                </>
              ) : (
                'Self-assess'
              )}
            </p>
            {question.explanation ? (
              <div className="prose mt-2 !text-[14px] !leading-relaxed">
                <p>
                  <RichText text={question.explanation} />
                </p>
              </div>
            ) : null}
          </div>

          {graded === null ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => send(typed, true)}>
                I covered this
              </Button>
              <Button size="sm" variant="quiet" onClick={() => send(typed, false)}>
                I missed something
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="quiet" onClick={reset}>
              <RotateCcw size={13} aria-hidden="true" />
              Try again
            </Button>
            {topicHref && topicLabel ? (
              <a href={topicHref} className="btn btn-sm">
                Back to {topicLabel}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
