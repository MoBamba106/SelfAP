import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import {
  findOpenSession,
  getEnrollments,
  getRecentSessions,
} from '@/lib/data/repository';
import { formatDuration, formatDayLabel } from '@/lib/utils/time';
import { courseTint } from '@/lib/utils/format';
import { StudyTimer, type PickerCourse, type OpenSessionSeed } from '@/components/study/study-timer';
import { Card, CardBody, EmptyState } from '@/components/ui/primitives';

export const metadata = { title: 'Study' };

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const [enrollments, open, recent] = await Promise.all([
    getEnrollments(user.id),
    findOpenSession(user.id),
    getRecentSessions(user.id, 8),
  ]);

  const preferred = params.course
    ? enrollments.find((e) => e.course.slug === params.course) ?? enrollments[0]
    : enrollments[0];

  const pickerCourses: PickerCourse[] = enrollments
    .map((e) => ({
      id: e.course.id,
      slug: e.course.slug,
      shortName: e.course.shortName,
      accent: e.course.accent,
      units: e.course.units.map((u) => ({
        id: u.id,
        code: u.code,
        title: u.title,
        topics: u.topics.map((t) => ({
          id: t.id,
          code: t.code,
          title: t.title,
          lessonId: t.lesson?.id ?? null,
        })),
      })),
    }))
    // Put the requested course first so the timer opens on it.
    .sort((a, b) => (a.id === preferred?.course.id ? -1 : b.id === preferred?.course.id ? 1 : 0));

  const openSeed: OpenSessionSeed | null = open
    ? {
        id: open.id,
        courseId: open.courseId,
        unitId: open.unitId,
        topicId: open.topicId,
        lessonId: open.lessonId,
        mode: open.mode,
        startedAt: open.startedAt.toISOString(),
        elapsedSeconds: Math.round(
          Math.max(
            0,
            ((open.heartbeatAt ?? open.startedAt).getTime() - open.startedAt.getTime()) / 1000,
          ),
        ),
      }
    : null;

  const nameOf = new Map(enrollments.map((e) => [e.courseId, e.course.shortName]));
  const accentOf = new Map(enrollments.map((e) => [e.courseId, e.course.accent]));

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow mb-1.5">Study</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Start a session
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inksoft">
          Pick a course, and a unit or topic if you have one in mind. The timer writes
          progress every 30 seconds, so it survives a closed tab or a dropped connection.
        </p>
      </header>

      {open ? (
        <div className="well flex flex-wrap items-center gap-3 px-4 py-3">
          <p className="text-sm text-inksoft">
            <span className="font-semibold text-ink">You have a session still running</span> from{' '}
            {formatDayLabel(open.startedAt)}. It is loaded in the timer below — stop and save
            it, or cancel it.
          </p>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <StudyTimer courses={pickerCourses} openSession={openSeed} />

        <div className="space-y-6">
          <Card>
            <div className="border-b border-linesoft px-4 py-3 sm:px-5">
              <p className="eyebrow mb-1">Recent sessions</p>
              <h2 className="font-display text-lg font-semibold text-ink">What you logged</h2>
            </div>
            <CardBody className="pt-2">
              {recent.length === 0 ? (
                <EmptyState
                  title="No sessions yet"
                  description="Your first timed session will appear here."
                />
              ) : (
                <ul className="divide-y divide-linesoft">
                  {recent.map((session) => (
                    <li
                      key={session.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                      style={courseTint(accentOf.get(session.courseId) ?? 'stat')}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {nameOf.get(session.courseId) ?? 'Course'}
                        </p>
                        <p className="truncate text-xs text-inkfaint">
                          {formatDayLabel(session.startedAt)} · {session.mode}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-inksoft">
                        {formatDuration(session.durationSeconds)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="py-4">
              <p className="eyebrow mb-2">Prefer to jump straight in?</p>
              <p className="text-sm leading-relaxed text-inksoft">
                Every lesson page has its own timer, so you can start studying the moment you
                open a topic.{' '}
                <Link href="/courses" className="text-accent underline underline-offset-2">
                  Browse the curriculum
                </Link>
                .
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
