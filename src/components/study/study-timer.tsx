'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { AlertTriangle, Check, Pause, Play, Square, X } from 'lucide-react';
import {
  pingStudySession,
  startStudySession,
  stopStudySession,
} from '@/lib/actions/study';
import { formatClock } from '@/lib/utils/time';
import { cn, courseTint } from '@/lib/utils/format';
import { Button } from '@/components/ui/primitives';
import { useRouter } from 'next/navigation';

export interface PickerCourse {
  id: string;
  slug: string;
  shortName: string;
  accent: string;
  units: {
    id: string;
    code: string;
    title: string;
    topics: { id: string; code: string; title: string; lessonId: string | null }[];
  }[];
}

export interface OpenSessionSeed {
  id: string;
  courseId: string;
  unitId: string | null;
  topicId: string | null;
  lessonId: string | null;
  mode: string;
  startedAt: string;
  elapsedSeconds: number;
}

const HEARTBEAT_MS = 30_000;
const AUTO_STOP_SECONDS = 4 * 3600;

type Phase = 'setup' | 'running' | 'paused' | 'stopping' | 'done';

/**
 * The study timer.
 *
 * Resilience is the point of the design:
 *   • a heartbeat every 30s writes elapsed time to the database, so closing
 *     the tab costs at most one interval
 *   • on load, an unfinished session is offered back for resume or discard
 *   • the clock stops itself at four hours, so an abandoned tab can never
 *     produce an absurd session
 */
export function StudyTimer({
  courses,
  openSession,
}: {
  courses: PickerCourse[];
  openSession: OpenSessionSeed | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(openSession ? 'running' : 'setup');
  const [courseId, setCourseId] = useState<string>(openSession?.courseId ?? courses[0]?.id ?? '');
  const [unitId, setUnitId] = useState<string>(openSession?.unitId ?? '');
  const [topicId, setTopicId] = useState<string>(openSession?.topicId ?? '');
  const [mode, setMode] = useState<'focus' | 'lesson' | 'practice' | 'review'>('focus');
  const [sessionId, setSessionId] = useState<string | null>(openSession?.id ?? null);
  const [elapsed, setElapsed] = useState(openSession?.elapsedSeconds ?? 0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedSeconds, setSavedSeconds] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const course = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId]);
  const unit = useMemo(() => course?.units.find((u) => u.id === unitId), [course, unitId]);
  const topic = useMemo(() => unit?.topics.find((t) => t.id === topicId), [unit, topicId]);
  const lessonId = topic?.lessonId ?? openSession?.lessonId ?? null;

  const tickRef = useRef<number | null>(null);
  const beatRef = useRef<number | null>(null);

  const startTicking = useCallback(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= AUTO_STOP_SECONDS) {
          // Reached the ceiling: stop the clock here; the stop handler runs below.
          return next;
        }
        return next;
      });
    }, 1000);
  }, []);

  const stopTicking = useCallback(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (beatRef.current) window.clearInterval(beatRef.current);
    tickRef.current = null;
    beatRef.current = null;
  }, []);

  // Auto-stop at the ceiling.
  useEffect(() => {
    if (elapsed >= AUTO_STOP_SECONDS && phase === 'running') {
      void finish(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase]);

  useEffect(() => () => stopTicking(), [stopTicking]);

  // Resume a session that survived a reload.
  useEffect(() => {
    if (openSession && sessionId === openSession.id) startTicking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function begin() {
    if (!courseId) {
      setError('Choose a course first.');
      return;
    }
    setError(null);
    start(async () => {
      const result = await startStudySession({
        courseId,
        unitId: unitId || null,
        topicId: topicId || null,
        lessonId,
        mode,
      });
      if (!result.ok || !result.data) {
        setError(result.message ?? 'Could not start the session.');
        return;
      }
      setSessionId(result.data.id);
      setElapsed(0);
      setPhase('running');
      startTicking();
      beatRef.current = window.setInterval(() => {
        void pingStudySession(result.data!.id, elapsedRef.current);
      }, HEARTBEAT_MS);
    });
  }

  // Mirror of the elapsed state so the heartbeat interval never goes stale.
  const elapsedRef = useRef(0);
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  function finish(discard: boolean) {
    if (!sessionId) return;
    stopTicking();
    setPhase('stopping');
    start(async () => {
      const result = await stopStudySession(sessionId, { notes, discard });
      setPhase('done');
      setSavedSeconds(result.data?.seconds ?? 0);
      router.refresh();
    });
  }

  function reset() {
    setSessionId(null);
    setElapsed(0);
    setNotes('');
    setSavedSeconds(null);
    setPhase('setup');
  }

  function pause() {
    stopTicking();
    setPhase('paused');
    if (sessionId) void pingStudySession(sessionId, elapsedRef.current);
  }

  function resume() {
    setPhase('running');
    startTicking();
    if (sessionId && !beatRef.current) {
      beatRef.current = window.setInterval(() => {
        void pingStudySession(sessionId, elapsedRef.current);
      }, HEARTBEAT_MS);
    }
  }

  const nearLimit = elapsed > AUTO_STOP_SECONDS - 300 && phase === 'running';

  return (
    <section
      className="card overflow-hidden"
      style={course ? courseTint(course.accent) : undefined}
      aria-labelledby="timer-heading"
    >
      <header className="flex items-center justify-between gap-3 border-b border-linesoft px-4 py-3 sm:px-5">
        <div>
          <p className="eyebrow mb-1">Study timer</p>
          <h2 id="timer-heading" className="font-display text-lg font-semibold text-ink">
            {phase === 'setup' ? 'What are you studying?' : (course?.shortName ?? 'Session')}
          </h2>
        </div>
        {phase === 'running' || phase === 'paused' ? (
          <span
            className={cn(
              'badge',
              phase === 'running' ? 'badge-good' : 'badge-warn',
            )}
          >
            <span className="chip-dot" aria-hidden="true" />
            {phase === 'running' ? 'Running' : 'Paused'}
          </span>
        ) : null}
      </header>

      <div className="px-4 py-5 sm:px-5">
        {/* ------------------------------------------------------ clock */}
        {phase !== 'setup' ? (
          <div className="mb-6 text-center">
            <p
              className="font-mono text-[clamp(2.8rem,12vw,4.5rem)] font-medium leading-none tabular-nums text-ink"
              role="timer"
              aria-live="off"
              aria-label={`Elapsed study time ${formatClock(elapsed)}`}
            >
              {formatClock(elapsed)}
            </p>
            <p className="mt-2 text-sm text-inksoft">
              {topic ? `Topic ${topic.code} · ${topic.title}` : unit ? `Unit ${unit.code}` : 'Free study'}
            </p>
            {nearLimit ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-warn">
                <AlertTriangle size={13} aria-hidden="true" />
                Sessions stop automatically at four hours
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ------------------------------------------------------ setup */}
        {phase === 'setup' ? (
          <div className="space-y-4">
            <div>
              <span className="label">Course</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Course">
                {courses.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCourseId(c.id);
                      setUnitId('');
                      setTopicId('');
                    }}
                    aria-pressed={courseId === c.id}
                    className={cn(
                      'btn',
                      courseId === c.id ? 'btn-primary' : '',
                    )}
                    style={courseId === c.id ? undefined : courseTint(c.accent)}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: courseId === c.id ? 'currentColor' : `var(--t-${c.accent})`,
                      }}
                    />
                    {c.shortName}
                  </button>
                ))}
              </div>
            </div>

            {course ? (
              <>
                <div>
                  <label className="label" htmlFor="unit-select">
                    Unit
                  </label>
                  <select
                    id="unit-select"
                    className="select"
                    value={unitId}
                    onChange={(e) => {
                      setUnitId(e.target.value);
                      setTopicId('');
                    }}
                  >
                    <option value="">Whole course</option>
                    {course.units.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unit {u.code} — {u.title}
                      </option>
                    ))}
                  </select>
                </div>

                {unit ? (
                  <div>
                    <label className="label" htmlFor="topic-select">
                      Topic
                    </label>
                    <select
                      id="topic-select"
                      className="select"
                      value={topicId}
                      onChange={(e) => setTopicId(e.target.value)}
                    >
                      <option value="">Whole unit</option>
                      {unit.topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} — {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </>
            ) : null}

            <div>
              <span className="label">Session type</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Session type">
                {(['focus', 'lesson', 'practice', 'review'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    className={cn('btn btn-sm', mode === m ? 'btn-primary' : '')}
                  >
                    {m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}

            <Button variant="primary" size="lg" onClick={begin} disabled={pending || !courseId}>
              <Play size={16} aria-hidden="true" />
              Start session
            </Button>
          </div>
        ) : null}

        {/* ---------------------------------------------------- controls */}
        {phase === 'running' || phase === 'paused' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {phase === 'running' ? (
                <Button onClick={pause}>
                  <Pause size={15} aria-hidden="true" />
                  Pause
                </Button>
              ) : (
                <Button variant="primary" onClick={resume}>
                  <Play size={15} aria-hidden="true" />
                  Resume
                </Button>
              )}
              <Button onClick={() => finish(false)} disabled={pending}>
                <Square size={14} aria-hidden="true" />
                Stop and save
              </Button>
              <Button variant="quiet" onClick={() => finish(true)} disabled={pending}>
                <X size={14} aria-hidden="true" />
                Cancel
              </Button>
            </div>

            <div>
              <label className="label" htmlFor="session-notes">
                Notes for this session <span className="font-normal text-inkfaint">(optional)</span>
              </label>
              <textarea
                id="session-notes"
                className="textarea"
                rows={3}
                value={notes}
                maxLength={4000}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you work through? What is still unclear?"
              />
            </div>

            <p className="text-xs leading-relaxed text-inkfaint">
              Progress is saved every 30 seconds, so closing this tab will not lose the
              session. Anything under 30 seconds is discarded rather than logged.
            </p>
          </div>
        ) : null}

        {/* ------------------------------------------------------- done */}
        {phase === 'done' ? (
          <div className="anim-pop text-center">
            {savedSeconds && savedSeconds > 0 ? (
              <>
                <svg
                  viewBox="0 0 24 24"
                  width="34"
                  height="34"
                  aria-hidden="true"
                  className="check-draw mx-auto text-good"
                  fill="none"
                >
                  <path
                    d="M4 12.5l5 5L20 6.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-3 font-display text-xl font-semibold text-ink">
                  {formatClock(savedSeconds)} logged
                </p>
                <p className="mt-1 text-sm text-inksoft">
                  Added to {course?.shortName ?? 'your course'} for this week.
                </p>
              </>
            ) : (
              <p className="font-display text-lg font-semibold text-ink">Session cancelled</p>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={reset}>
                Start another
              </Button>
              <Button href="/home">
                <Check size={14} aria-hidden="true" />
                Back to home
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
