import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { COURSES } from '@/content';
import { getEnrollments, getPracticeSummary, getCourseRollups } from '@/lib/data/repository';
import { courseTint } from '@/lib/utils/format';
import { Button, Card, CardBody, EmptyState } from '@/components/ui/primitives';

export const metadata = { title: 'Practice' };

/**
 * Practice hub: pick a mode and a course. Deliberately no "random quiz"
 * button — a set is always scoped to a course, and can be narrowed to the
 * units you are actually working on.
 */
export default async function PracticePage() {
  const user = await requireUser();
  const [enrollments, summary, rollups] = await Promise.all([
    getEnrollments(user.id),
    getPracticeSummary(user.id),
    getCourseRollups(user.id),
  ]);

  const enrolled = new Set(enrollments.map((e) => e.course.slug));
  const courses = [...COURSES].sort((a, b) => Number(enrolled.has(b.slug)) - Number(enrolled.has(a.slug)));

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-1.5">Practice</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Practise where it is weak
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inksoft">
          Every question is original to SelfAP and written to the published question types for
          its exam. Nothing here is copied from a past paper or a textbook.
        </p>
        {summary.total ? (
          <p className="mt-3 text-sm text-inksoft">
            <span className="font-semibold text-ink">{summary.total}</span> attempts so far ·{' '}
            <span className="font-semibold text-ink">
              {Math.round((summary.accuracy ?? 0) * 100)}%
            </span>{' '}
            graded correct
          </p>
        ) : null}
      </header>

      {enrollments.length === 0 ? (
        <EmptyState
          title="Add a course first"
          description="Practice is scoped to a course so questions match its exam."
          action={
            <Button href="/courses" variant="primary">
              Browse courses
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => {
            const rollup = rollups.get(course.id);
            const questionTotal = course.topics.reduce((n, t) => n + t.questions.length, 0);
            return (
              <li
                key={course.id}
                className="card card-spine px-5 py-4"
                style={courseTint(course.accent)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">{course.code}</h2>
                    <p className="mt-0.5 text-xs text-inkfaint">
                      {questionTotal} questions ·{' '}
                      {rollup?.accuracy !== null && rollup?.accuracy !== undefined
                        ? `${Math.round(rollup.accuracy * 100)}% accuracy`
                        : 'not attempted yet'}
                    </p>
                  </div>
                  {!enrolled.has(course.slug) ? <span className="badge">not added</span> : null}
                </div>

                <p className="mt-3 text-sm leading-relaxed text-inksoft">{course.tagline}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button href={`/practice/${course.slug}?mode=mixed`} variant="primary" size="sm">
                    Mixed set
                  </Button>
                  <Button href={`/practice/${course.slug}?mode=weak`} size="sm">
                    Weak areas
                  </Button>
                  <Button href={`/practice/${course.slug}?mode=timed`} size="sm">
                    Timed
                  </Button>
                </div>

                <p className="mt-3 text-xs text-inkfaint">
                  {course.topicCount} topics ·{' '}
                  <Link
                    href={`/courses/${course.slug}`}
                    className="text-accent underline underline-offset-2"
                  >
                    open course
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <CardBody className="py-4">
          <p className="eyebrow mb-1.5">How grading works</p>
          <p className="text-sm leading-relaxed text-inksoft">
            Multiple-choice and short-answer questions are marked automatically. Free-response
            prompts are written to the official rubric and marked by you against it — that
            self-mark feeds your mastery state, so answer honestly. Every answer shows the
            reasoning and links back to the lesson that covers it.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
