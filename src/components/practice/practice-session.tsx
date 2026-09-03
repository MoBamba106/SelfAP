'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Flag, RotateCcw } from 'lucide-react';
import { submitAnswer } from '@/lib/actions/workspace';
import { answerAccepted, answerIndex, answerText, type PracticeQuestion } from '@/content';
import { formatClock } from '@/lib/utils/time';
import { cn } from '@/lib/utils/format';
import { Button, Card, CardBody } from '@/components/ui/primitives';

type Outcome = { correct: boolean | null };

export function PracticeSession({
  courseCode,
  courseSlug,
  mode,
  questions,
  perQuestionSeconds,
}: {
  courseCode: string;
  courseSlug: string;
  mode: string;
  questions: PracticeQuestion[];
  perQuestionSeconds: number | null;
}) {
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<(Outcome | null)[]>(() => questions.map(() => null));
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [secondsLeft, setSecondsLeft] = useState(
    perQuestionSeconds ? perQuestionSeconds * questions.length : 0,
  );
  const [timeUp, setTimeUp] = useState(false);
  const secondsRef = useRef(secondsLeft);

  const question = questions[index]!;

  /* ---------------------------------------------------------------- clock */
  useEffect(() => {
    if (!perQuestionSeconds || finished || timeUp) return;
    const id = window.setInterval(() => {
      const next = secondsRef.current - 1;
      secondsRef.current = next;
      setSecondsLeft(Math.max(0, next));
      if (next <= 0) {
        window.clearInterval(id);
        setTimeUp(true);
        /* End the set here rather than in a second effect watching `timeUp` —
         * an interval callback is an external-system boundary, so this does
         * not cascade an extra render pass. */
        setFinished(true);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [perQuestionSeconds, finished, timeUp]);

  const finish = useCallback(() => setFinished(true), []);

  const advance = useCallback(
    (result: Outcome) => {
      setOutcomes((prev) => {
        const next = [...prev];
        next[index] = result;
        return next;
      });
      if (index + 1 >= questions.length) finish();
      else setIndex((i) => i + 1);
    },
    [index, questions.length, finish],
  );

  const send = useCallback(
    async (
      answer: unknown,
      selfGrade?: boolean,
    ): Promise<{ ok: boolean; correct: boolean | null; message?: string }> => {
      setSubmitting(true);
      setFormError(null);
      const res = await submitAnswer({
        questionId: question.id,
        answer,
        selfGrade,
        timeSpentSeconds: 0,
      });
      setSubmitting(false);
      if (!res.ok) {
        setFormError(res.message ?? 'Could not save that answer.');
        return { ok: false, correct: null };
      }
      return { ok: true, correct: res.data?.correct ?? null };
    },
    [question.id],
  );

  const answered = outcomes.filter(Boolean).length;
  const graded = outcomes.filter((o): o is Outcome => o !== null && o.correct !== null);
  const right = graded.filter((o) => o.correct).length;

  /* ------------------------------------------------------------- summary */
  if (finished) {
    const accuracy = graded.length ? Math.round((right / graded.length) * 100) : null;
    return (
      <Card className="anim-rise px-5 py-6 text-center">
        <p className="eyebrow mb-2">{courseCode} · {mode}</p>
        <h2 className="font-display text-3xl font-semibold text-ink">Set complete</h2>
        <p className="mt-3 text-5xl font-semibold tabular-nums text-accent">
          {accuracy === null ? '—' : `${accuracy}%`}
        </p>
        <p className="mt-2 text-sm text-inksoft">
          {right} of {graded.length} graded correct
          {timeUp ? ' · clock expired' : ''}
          {answered < questions.length ? ` · ${questions.length - answered} not attempted` : ''}
        </p>

        <ol className="mx-auto mt-6 grid max-w-md gap-1.5 text-left">
          {questions.map((q, i) => {
            const o = outcomes[i];
            return (
              <li
                key={q.id}
                className="flex items-center gap-2.5 border-l-2 pl-3 text-xs"
                style={{
                  borderColor:
                    o === null
                      ? 'var(--rule)'
                      : o.correct === null
                        ? 'var(--ochre)'
                        : o.correct
                          ? 'var(--good)'
                          : 'var(--bad)',
                }}
              >
                <span className="w-7 shrink-0 font-mono text-inkghost">{q.topicCode}</span>
                <span className="min-w-0 flex-1 truncate text-inksoft">{q.prompt}</span>
                <span
                  className={cn(
                    'shrink-0 font-semibold',
                    o === null
                      ? 'text-inkghost'
                      : o.correct === null
                        ? 'text-ochre'
                        : o.correct
                          ? 'text-good'
                          : 'text-bad',
                  )}
                >
                  {o === null ? 'skipped' : o.correct === null ? 'self-marked' : o.correct ? 'right' : 'wrong'}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            href={`/courses/${courseSlug}/topics/${question.topicCode}`}
            variant="primary"
          >
            Study topic {question.topicCode}
          </Button>
          <Button href={`/practice/${courseSlug}?mode=mixed`}>
            <RotateCcw size={14} aria-hidden="true" />
            Another set
          </Button>
          <Button href={`/progress`} variant="quiet">
            See progress
          </Button>
        </div>
      </Card>
    );
  }

  /* ------------------------------------------------------------ question */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs text-inkfaint">
          Question {index + 1} of {questions.length}
        </p>
        {perQuestionSeconds ? (
          <p
            className={cn(
              'font-mono text-sm font-semibold tabular-nums',
              secondsLeft < 60 ? 'text-bad' : 'text-ink',
            )}
            aria-live="off"
          >
            {formatClock(secondsLeft)}
          </p>
        ) : null}
      </div>

      <ul className="flex gap-1" aria-hidden="true">
        {questions.map((q, i) => {
          const o = outcomes[i];
          return (
            <li
              key={q.id}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i === index
                  ? 'bg-accent'
                  : o === null
                    ? 'bg-rule'
                    : o.correct === null
                      ? 'bg-ochre/70'
                      : o.correct
                        ? 'bg-good'
                        : 'bg-bad',
              )}
            />
          );
        })}
      </ul>

      <Card className="anim-pop">
        <CardBody className="px-4 py-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/courses/${courseSlug}/topics/${question.topicCode}`}
              className="badge badge-ochre font-mono hover:brightness-95"
            >
              {question.topicCode}
            </Link>
            <span className="badge">{question.kind === 'mcq' ? 'Multiple choice' : question.kind === 'frq' ? 'Free response' : 'Short answer'}</span>
            {question.difficulty > 3 ? <span className="badge ml-auto">challenging</span> : null}
          </div>

          {formError ? <p className="field-error mb-3">{formError}</p> : null}

          {question.kind === 'mcq' ? (
            <McqView
              key={question.id}
              question={question}
              submitting={submitting}
              onSubmit={async (selected) => {
                const res = await send(selected);
                if (res.ok) advance({ correct: res.correct });
              }}
              onFlag={finish}
            />
          ) : (
            <WrittenView
              key={question.id}
              question={question}
              submitting={submitting}
              onSubmit={async (answer, selfGrade) => {
                const res = await send(answer, selfGrade);
                if (res.ok) advance({ correct: res.correct });
              }}
              onFlag={finish}
            />
          )}
        </CardBody>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="quiet"
          size="sm"
          onClick={() => advance({ correct: null })}
          disabled={submitting}
        >
          Skip
        </Button>
        <Button variant="quiet" size="sm" onClick={finish} disabled={submitting}>
          <Flag size={13} aria-hidden="true" />
          End set
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ MCQ */

function McqView({
  question,
  submitting,
  onSubmit,
  onFlag,
}: {
  question: PracticeQuestion;
  submitting: boolean;
  onSubmit: (selected: number) => Promise<void>;
  onFlag: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const key = answerIndex(question);

  const submit = async () => {
    if (selected === null) return;
    const isCorrect = key !== null && key === selected;
    setCorrect(isCorrect);
    setShowAnswer(true);
    await onSubmit(selected);
  };

  return (
    <div>
      <p className="mb-4 text-[15px] leading-relaxed text-ink">{question.prompt}</p>

      <div role="radiogroup" aria-label="Answer choices" className="mb-4 space-y-2">
        {question.choices.map((choice, i) => {
          const isPicked = selected === i;
          const reveal = showAnswer && key === i;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isPicked}
              disabled={submitting}
              onClick={() => !showAnswer && setSelected(i)}
              className={cn(
                'flex w-full items-start gap-3 rounded-[6px] border border-line bg-paper2 px-3.5 py-3 text-left transition-all duration-150',
                !showAnswer && 'hover:-translate-y-[1px] hover:border-accent hover:shadow-card',
                isPicked && !reveal && 'border-accent bg-tint-soft',
                reveal && 'border-good bg-good/10',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-[11px] font-bold',
                  reveal
                    ? 'border-good bg-good text-white'
                    : isPicked
                      ? 'border-accent bg-accent text-white'
                      : 'border-line bg-paper text-inksoft',
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="pt-0.5 text-sm leading-relaxed text-ink">{choice}</span>
            </button>
          );
        })}
      </div>

      {showAnswer ? (
        <div
          className={cn(
            'well anim-rise border-l-4 px-4 py-3.5',
            correct ? 'border-l-good' : 'border-l-bad',
          )}
        >
          <p className="text-sm font-semibold text-ink">
            {correct
              ? 'Correct.'
              : `Not quite — the answer is ${key === null ? 'shown below' : String.fromCharCode(65 + key)}.`}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-inksoft">{question.explanation}</p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <Button variant="quiet" size="sm" onClick={onFlag} disabled={submitting}>
            <Flag size={13} aria-hidden="true" />
            Flag for review
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={selected === null || submitting}
          >
            {submitting ? 'Checking…' : 'Check answer'}
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- written */

function WrittenView({
  question,
  submitting,
  onSubmit,
  onFlag,
}: {
  question: PracticeQuestion;
  submitting: boolean;
  onSubmit: (answer: string, selfGrade?: boolean) => Promise<void>;
  onFlag: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);

  const submit = async (selfGrade?: boolean) => {
    if (!answer.trim() && !showAnswer) return;
    setShowAnswer(true);
    await onSubmit(answer, selfGrade);
  };

  return (
    <div>
      <p className="mb-3 text-[15px] leading-relaxed text-ink">{question.prompt}</p>

      {!showAnswer ? (
        <>
          <label className="label" htmlFor={`pa-${question.id}`}>
            {question.kind === 'frq' ? 'Your response' : 'Your answer'}
          </label>
          <textarea
            id={`pa-${question.id}`}
            className="textarea min-h-32"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={
              question.kind === 'frq'
                ? 'Write it out properly — under exam conditions nobody gives you credit for a half-formed idea.'
                : 'A short answer is fine; precision matters more than length.'
            }
            disabled={submitting}
          />
          <p className="hint mt-1.5">
            {question.kind === 'frq'
              ? 'Free response is marked by you against the rubric, so write as you would on the exam.'
              : 'Your wording does not have to match exactly — the accepted answers are checked as substrings.'}
          </p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button variant="quiet" size="sm" onClick={onFlag} disabled={submitting}>
              <Flag size={13} aria-hidden="true" />
              Flag for review
            </Button>
            <div className="flex gap-2">
              <Button variant="quiet" onClick={() => setShowAnswer(true)} disabled={submitting}>
                <ArrowLeft size={14} aria-hidden="true" className="rotate-180" />
                Show answer
              </Button>
              <Button
                variant="primary"
                onClick={() => submit()}
                disabled={!answer.trim() || submitting}
              >
                {submitting ? 'Saving…' : 'Check answer'}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {answer.trim() ? (
            <div className="well px-4 py-3">
              <p className="eyebrow mb-1.5">You wrote</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-inksoft">{answer}</p>
            </div>
          ) : null}

          <div className="well border-l-4 border-l-accent px-4 py-3.5">
            <p className="text-sm font-semibold text-ink">
              {question.kind === 'frq' ? 'What full credit looks like' : 'Model answer'}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-inksoft">
              {answerText(question)}
            </p>
            {answerAccepted(question).length ? (
              <p className="mt-2 text-xs leading-relaxed text-inkfaint">
                Any of these earns credit:{' '}
                <span className="font-mono">{answerAccepted(question).join(' · ')}</span>
              </p>
            ) : null}
            <p className="mt-2.5 border-t border-linesoft pt-2.5 text-sm leading-relaxed text-inksoft">
              {question.explanation}
            </p>
          </div>

          <div>
            <p className="label mb-2">How did yours compare?</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={submitting}
                onClick={() => submit(true)}
              >
                I had it
              </Button>
              <Button size="sm" disabled={submitting} onClick={() => submit(false)}>
                Not quite
              </Button>
              <Button
                variant="quiet"
                size="sm"
                disabled={submitting}
                onClick={() => submit(undefined)}
              >
                Skip marking
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
