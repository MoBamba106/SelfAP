import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CalendarClock, CalendarRange, ExternalLink } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { getCourse } from '@/content';
import {
  getCourseRollups,
  getCourseWeeks,
  getEnrollments,
  getLessonProgressMap,
  getPracticeSummary,
  getRecommendation,
  getTopicProgressMap,
  getTopicStrengths,
} from '@/lib/data/repository';
import { courseTint } from '@/lib/utils/format';
import { daysUntil, formatDate, formatDuration, formatGoal } from '@/lib/utils/time';
import { EnrolButton } from '@/components/course/course-card';
import { TopicRow } from '@/components/course/topic-row';
import { CourseTools } from '@/components/course/course-tools';
import { Badge, Button, Card, CardBody, EmptyState, Meter, Stat } from '@/components/ui/primitives';

/** Resolves the document title, and 404s early for an unknown course. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();
  return { title: course.code };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();

  const [enrollments, rollups, weeks, strengths, practice, topicProgress, lessonProgress, recommendation] =
    await Promise.all([
      getEnrollments(user.id),
      getCourseRollups(user.id),
      getCourseWeeks(user.id),
      getTopicStrengths(user.id, course),
      getPracticeSummary(user.id, course.id),
      getTopicProgressMap(user.id, [course.id]),
      getLessonProgressMap(user.id, [course.id]),
      getRecommendation(user.id),
    ]);

  const enrollment = enrollments.find((e) => e.course.id === course.id);
  const rollup = rollups.get(course.id);
  const week = weeks.find((w) => w.course.id === course.id);
  const isEnrolled = Boolean(enrollment);
  const rec = recommendation?.course.id === course.id ? recommendation : null;
  const examIn = daysUntil(course.exam.date);

  // Next lesson the student has not finished, in curriculum order.
  const nextLesson = course.topics.find(
    (topic) => topic.lesson && !lessonProgress.get(topic.lesson.id)?.completedAt,
  )?.lesson;

  return (
    <div className="space-y-8" style={courseTint(course.accent)}>
      {/* ----------------------------------------------------- header */}
      <header className="anim-rise">
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1.5 text-xs text-inkfaint">
            <li>
              <Link href="/courses" className="hover:text-accent">
                Courses
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-inksoft">
              {course.shortName}
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.5rem]">
              {course.code}
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-inksoft">{course.tagline}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isEnrolled ? (
              <>
                <Badge tone="good" dot>
                  In your workspace
                </Badge>
                <Button href={`/courses/${course.slug}/plan`} size="sm">
                  <CalendarRange size={14} aria-hidden="true" />
                  Schedule
                </Button>
              </>
            ) : (
              <EnrolButton slug={course.slug} />
            )}
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-inksoft">{course.description}</p>
      </header>

      {/* ------------------------------------------------------ stats */}
      <Card className="px-5 py-4">
        <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
          <Stat label="Curriculum" value={`${rollup?.completion ?? 0}%`} hint={`${rollup?.lessonsDone ?? 0}/${course.topicCount} lessons`} />
          <Stat
            label="This week"
            value={formatDuration(week?.seconds ?? 0)}
            hint={`goal ${formatGoal(week?.goalMinutes ?? 0)}`}
          />
          <Stat
            label="Accuracy"
            value={practice.accuracy !== null ? `${Math.round(practice.accuracy * 100)}%` : '—'}
            hint={`${practice.total} graded attempts`}
          />
          <Stat
            label="Topics mastered"
            value={rollup?.masteryCounts.mastered ?? 0}
            hint={`${rollup?.masteryCounts.strong ?? 0} strong`}
          />
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* ------------------------------------------------ units list */}
        <div className="space-y-6">
          {rec ? (
            <Card>
              <CardBody className="py-4">
                <p className="eyebrow mb-2">Next up</p>
                <p className="font-display text-lg font-semibold leading-snug text-ink">
                  Topic {rec.topic.code} — {rec.topic.title}
                </p>
                <p className="mt-1 text-sm text-inksoft">
                  {rec.unitProgress.done}/{rec.unitProgress.total} topics done in Unit{' '}
                  {rec.unit.code}.
                </p>
                <div className="mt-3">
                  <Button href={rec.href} variant="primary" size="sm">
                    Start lesson
                    <ArrowRight size={14} aria-hidden="true" />
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : nextLesson ? (
            <Card>
              <CardBody className="py-4">
                <p className="eyebrow mb-2">Next up</p>
                <p className="font-display text-lg font-semibold leading-snug text-ink">
                  {nextLesson.title}
                </p>
                <div className="mt-3">
                  <Button href={`/learn/${nextLesson.id}`} variant="primary" size="sm">
                    Start lesson
                    <ArrowRight size={14} aria-hidden="true" />
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {course.units.map((unit) => {
            const done = unit.topics.filter(
              (t) =>
                topicProgress.get(t.id)?.lessonDone ||
                (t.lesson ? Boolean(lessonProgress.get(t.lesson.id)?.completedAt) : false),
            ).length;
            const percent = Math.round((done / Math.max(1, unit.topics.length)) * 100);
            return (
              <section key={unit.id} className="card" aria-labelledby={`unit-${unit.code}`}>
                <header className="border-b border-linesoft px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="eyebrow mb-1">
                        Unit {unit.code}
                        {unit.examWeight ? ` · ${unit.examWeight} of the exam` : ''}
                      </p>
                      <h2 id={`unit-${unit.code}`} className="font-display text-lg font-semibold text-ink">
                        <Link
                          href={`/courses/${course.slug}/units/${unit.code}`}
                          className="underline-offset-4 transition-colors hover:text-accent hover:underline"
                        >
                          {unit.title}
                        </Link>
                      </h2>
                      {unit.summary ? (
                        <p className="mt-1 max-w-prose text-sm leading-relaxed text-inksoft">
                          {unit.summary}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xs tabular-nums text-inksoft">
                        {done}/{unit.topics.length}
                      </p>
                      <div className="mt-1.5 w-24">
                        <Meter value={percent} max={100} label={`Unit ${unit.code} progress`} />
                      </div>
                    </div>
                  </div>
                </header>
                <ul className="divide-y divide-linesoft">
                  {unit.topics.map((topic) => (
                    <TopicRow
                      key={topic.id}
                      topic={topic}
                      courseSlug={course.slug}
                      progress={topicProgress.get(topic.id)}
                      lessonDone={
                        topic.lesson ? Boolean(lessonProgress.get(topic.lesson.id)?.completedAt) : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {/* ---------------------------------------------------- sidebar */}
        <div className="space-y-6">
          {/* exam */}
          <Card>
            <div className="border-b border-linesoft px-4 py-3 sm:px-5">
              <p className="eyebrow mb-1">Exam</p>
              <h2 className="font-display text-lg font-semibold text-ink">
                <CalendarClock size={15} className="mr-1.5 inline text-accent" aria-hidden="true" />
                {course.exam.date ? formatDate(course.exam.date) : 'Date to be confirmed'}
              </h2>
            </div>
            <CardBody>
              {examIn !== null ? (
                <p className="mb-3 font-display text-2xl font-semibold text-ink">
                  {examIn > 0 ? `${examIn} days away` : examIn === 0 ? 'Today' : `${Math.abs(examIn)} days ago`}
                </p>
              ) : null}
              {course.exam.durationMinutes ? (
                <p className="text-sm text-inksoft">
                  {Math.floor(course.exam.durationMinutes / 60)}h
                  {course.exam.durationMinutes % 60 ? ` ${course.exam.durationMinutes % 60}m` : ''} total
                </p>
              ) : null}
              {course.exam.sections.length ? (
                <ul className="mt-3 space-y-2 border-t border-linesoft pt-3">
                  {course.exam.sections.map((section) => (
                    <li key={section.name} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 text-inksoft">{section.name}</span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-inkfaint">
                        {section.count} · {section.time} · {section.weight}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {course.exam.provisional ? (
                <p className="mt-3 text-xs leading-relaxed text-inkfaint">
                  Dates shown are provisional. Confirm on the official AP site before you plan
                  around them.
                </p>
              ) : null}
              <div className="mt-3">
                <Button href="/exam" size="sm">
                  Exam prep mode
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* weak + strong */}
          <Card>
            <div className="border-b border-linesoft px-4 py-3 sm:px-5">
              <p className="eyebrow mb-1">Where you stand</p>
              <h2 className="font-display text-lg font-semibold text-ink">Weak and strong topics</h2>
            </div>
            <CardBody className="space-y-4">
              {strengths.weak.length === 0 && strengths.strong.length === 0 ? (
                <EmptyState
                  title="Not enough practice yet"
                  description="Answer a few questions on a topic and SelfAP will start telling you where you are weak."
                />
              ) : null}

              {strengths.weak.length ? (
                <div>
                  <p className="eyebrow mb-2 text-bad">Needs work</p>
                  <ul className="space-y-1.5">
                    {strengths.weak.map(({ topic, progress }) => (
                      <li key={topic.id}>
                        <Link
                          href={
                            topic.lesson
                              ? `/learn/${topic.lesson.id}`
                              : `/courses/${course.slug}/topics/${topic.code}`
                          }
                          className="flex items-baseline justify-between gap-3 text-sm text-ink underline-offset-4 hover:text-accent hover:underline"
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-mono text-xs text-inkghost">{topic.code}</span>{' '}
                            {topic.title}
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-bad">
                            {Math.round((progress.mastery.accuracy ?? 0) * 100)}%
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {strengths.strong.length ? (
                <div>
                  <p className="eyebrow mb-2 text-good">Solid</p>
                  <ul className="space-y-1.5">
                    {strengths.strong.map(({ topic, progress }) => (
                      <li key={topic.id} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-inksoft">
                          <span className="font-mono text-xs text-inkghost">{topic.code}</span>{' '}
                          {topic.title}
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-good">
                          {Math.round((progress.mastery.accuracy ?? 0) * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {/* mastery distribution */}
          {rollup ? (
            <Card>
              <div className="border-b border-linesoft px-4 py-3 sm:px-5">
                <p className="eyebrow mb-1">Mastery spread</p>
                <h2 className="font-display text-lg font-semibold text-ink">All {course.topicCount} topics</h2>
              </div>
              <CardBody>
                <ul className="space-y-2">
                  {(['mastered', 'strong', 'practicing', 'learning', 'not-started'] as const).map((status) => {
                    const count = rollup.masteryCounts[status];
                    return (
                      <li key={status} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-xs capitalize text-inksoft">{status.replace('-', ' ')}</span>
                        <div className="meter flex-1">
                          <span
                            className="meter-fill"
                            style={{
                              width: `${Math.round((count / Math.max(1, course.topicCount)) * 100)}%`,
                              background:
                                status === 'mastered'
                                  ? 'var(--good)'
                                  : status === 'not-started'
                                    ? 'var(--ink-ghost)'
                                    : 'var(--accent)',
                            }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-inkfaint">
                          {count}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {/* external resources */}
          {course.externalResources.length ? (
            <Card>
              <div className="border-b border-linesoft px-4 py-3 sm:px-5">
                <p className="eyebrow mb-1">Official resources</p>
                <h2 className="font-display text-lg font-semibold text-ink">External, not hosted here</h2>
              </div>
              <CardBody>
                <ul className="space-y-2">
                  {course.externalResources.map((resource) => (
                    <li key={resource.url}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="flex items-start gap-2 text-sm text-ink underline-offset-4 hover:text-accent hover:underline"
                      >
                        <ExternalLink size={13} className="mt-0.5 shrink-0 text-inkghost" aria-hidden="true" />
                        <span>
                          {resource.label}
                          <span className="block text-xs text-inkfaint">
                            {resource.kind === 'official' ? 'College Board' : resource.kind}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-inkfaint">
                  SelfAP writes its own lessons and questions. Past exam questions and other
                  College Board material stay on College Board&apos;s own site.
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      {/* -------------------------------------------------- course tools */}
      <CourseTools course={course} />
    </div>
  );
}

