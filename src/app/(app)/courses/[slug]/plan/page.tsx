import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, Check, Play } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { getCourse } from '@/content';
import { getEnrollments, getPacing, getProfile, getTopicProgressMap } from '@/lib/data/repository';
import { buildSchedule, estimateTopic } from '@/lib/pacing/schedule';
import { courseTint } from '@/lib/utils/format';
import { formatDate, formatDuration, formatGoal, parseIsoDate, weekStart } from '@/lib/utils/time';
import { MASTERY_LABEL } from '@/lib/utils/mastery';
import { PacingEditor } from '@/components/course/pacing-editor';
import { Badge, Button, Card, CardBody, Meter } from '@/components/ui/primitives';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();
  return { title: `${course.code} study schedule` };
}

export default async function CoursePlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();

  const today = new Date();

  const [pacing, profile, topicProgress, enrollments] = await Promise.all([
    getPacing(user.id, course.id),
    getProfile(user.id),
    getTopicProgressMap(user.id, [course.id]),
    getEnrollments(user.id),
  ]);

  const weekStartDay = profile?.weekStartDay ?? 1;
  const enrollment = enrollments.find((e) => e.course.id === course.id);

  /* Without a saved plan we still show a schedule, built from sensible
   * defaults, so the page explains itself before you commit to anything. */
  const defaultEnd = course.exam.date
    ? parseIsoDate(course.exam.date)
    : new Date(today.getTime() + 84 * 86_400_000);
  const inputs = {
    startDate: pacing ? parseIsoDate(pacing.startDate) : weekStart(today, weekStartDay),
    endDate: pacing ? parseIsoDate(pacing.endDate) : defaultEnd,
    weeklyMinutes: pacing?.weeklyMinutes ?? enrollment?.weeklyGoalMinutes ?? 150,
    mode: pacing?.mode ?? ('calendar' as const),
    weekStartDay,
    today,
  };

  const doneTopicIds = new Set(
    course.topics.filter((t) => topicProgress.get(t.id)?.lessonDone).map((t) => t.id),
  );

  const schedule = buildSchedule(course, inputs, doneTopicIds);
  const currentWeek =
    schedule.currentWeekIndex !== null ? schedule.weeks[schedule.currentWeekIndex] : null;
  const doneMinutes = Math.round((schedule.percentComplete / 100) * schedule.totalMinutes);

  return (
    <div className="space-y-6" style={courseTint(course.accent)}>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-inkfaint">
          <li>
            <Link href="/courses" className="hover:text-accent">
              Courses
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/courses/${course.slug}`} className="hover:text-accent">
              {course.shortName}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-inksoft">
            Schedule
          </li>
        </ol>
      </nav>

      <header>
        <p className="eyebrow mb-1.5">Pacing</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {course.code} schedule
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inksoft">
          {course.topicCount} topics spread over {schedule.weeks.length} weeks — about{' '}
          <strong className="font-semibold text-ink">{formatGoal(schedule.weeklyTarget)}</strong> of
          work a week. The plan is recalculated from the curriculum and your real progress, so it
          adjusts itself as topics are added or as you fall behind.
        </p>
      </header>

      {!schedule.feasible ? (
        <div className="callout" data-kind="warning">
          <span className="callout-label">This plan is tight</span>
          <p className="text-sm leading-relaxed text-inksoft">{schedule.reason}</p>
        </div>
      ) : null}

      <Card className="px-5 py-4">
        <div className="grid gap-5 sm:grid-cols-4">
          <div>
            <p className="eyebrow mb-1">Complete</p>
            <p className="font-mono text-2xl tabular-nums text-ink">{schedule.percentComplete}%</p>
            <p className="text-[11px] text-inkfaint">
              {formatDuration(doneMinutes)} of {formatDuration(schedule.totalMinutes)}
            </p>
          </div>
          <div>
            <p className="eyebrow mb-1">Per week</p>
            <p className="font-mono text-2xl tabular-nums text-ink">
              {formatGoal(schedule.weeklyTarget)}
            </p>
            <p className="text-[11px] text-inkfaint">your budget {formatGoal(inputs.weeklyMinutes)}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Behind by</p>
            <p className="font-mono text-2xl tabular-nums text-ink">
              {schedule.behindBy}
              <span className="ml-1 text-sm font-normal text-inkfaint">
                topic{schedule.behindBy === 1 ? '' : 's'}
              </span>
            </p>
            <p className="text-[11px] text-inkfaint">
              {schedule.behindBy ? 'from earlier weeks' : 'you are on schedule'}
            </p>
          </div>
          <div>
            <p className="eyebrow mb-1">
              {inputs.mode === 'time' ? 'Projected finish' : 'Finish by'}
            </p>
            <p className="text-sm font-semibold text-ink">
              {inputs.mode === 'time' && schedule.projectedFinish
                ? formatDate(schedule.projectedFinish)
                : formatDate(inputs.endDate)}
            </p>
            <p className="text-[11px] text-inkfaint">
              {course.exam.date && course.exam.date >= new Date().toISOString().slice(0, 10)
                ? `exam ${formatDate(course.exam.date)}`
                : 'no exam date set'}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Meter
            value={doneMinutes}
            max={Math.max(schedule.totalMinutes, 1)}
            label="Overall schedule progress by estimated work"
          />
        </div>
      </Card>

      {/* ------------------------------------------------- this week */}
      {currentWeek ? (
        <Card className="card-spine px-5 py-4" aria-labelledby="this-week">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="this-week" className="font-display text-xl font-semibold text-ink">
              This week
            </h2>
            <p className="font-mono text-xs text-inkfaint">
              {currentWeek.doneTopics}/{currentWeek.topics.length} done ·{' '}
              {formatDuration(currentWeek.estimatedMinutes)} of work
            </p>
          </div>
          <ul className="mt-3 space-y-2">
            {currentWeek.topics.map((item) => {
              const progress = topicProgress.get(item.topic.id);
              const status = progress?.mastery.status ?? (item.done ? 'learning' : 'not-started');
              return (
                <li
                  key={item.topic.id}
                  className="flex flex-wrap items-center gap-2.5 rounded-[6px] border border-line bg-paper2 px-3.5 py-2.5"
                >
                  {item.done ? (
                    <Check size={15} className="shrink-0 text-good" aria-hidden="true" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full border border-line"
                    />
                  )}
                  <span className="font-mono text-xs text-inkghost">{item.topic.code}</span>
                  <Link
                    href={`/courses/${course.slug}/topics/${item.topic.code}`}
                    className={`min-w-0 flex-1 text-sm font-semibold underline-offset-4 hover:text-accent hover:underline ${
                      item.done ? 'text-inkfaint line-through' : 'text-ink'
                    }`}
                  >
                    {item.topic.title}
                  </Link>
                  <span className="badge">{MASTERY_LABEL[status]}</span>
                  <span className="font-mono text-[11px] tabular-nums text-inkfaint">
                    {formatDuration(item.estimatedMinutes)}
                  </span>
                  {item.topic.lesson && !item.done ? (
                    <Button href={`/learn/${item.topic.lesson.id}`} size="sm">
                      <Play size={12} aria-hidden="true" />
                      Start
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-inkfaint">
            Roughly{' '}
            {formatDuration(Math.round(currentWeek.estimatedMinutes / Math.max(1, Math.min(7, currentWeek.topics.length))))}{' '}
            a sitting if you split this across the week.
          </p>
        </Card>
      ) : null}

      <PacingEditor
        courseId={course.id}
        initial={pacing}
        examDate={course.exam.date}
      />

      {/* ------------------------------------------------ whole plan */}
      <section aria-labelledby="whole-plan" className="space-y-3">
        <div className="rule-label">
          <h2 id="whole-plan" className="font-display text-xl font-semibold text-ink">
            The whole plan
          </h2>
        </div>

        <ol className="space-y-3">
          {schedule.weeks.map((week) => {
            const isCurrent = week.status === 'current';
            return (
              <li
                key={week.index}
                className={`card px-4 py-3.5 sm:px-5 ${isCurrent ? 'card-spine border-accent' : ''}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-ink">
                    {isCurrent ? 'This week' : `Week ${week.index + 1}`}
                    <span className="ml-2 font-mono text-xs font-normal text-inkfaint">
                      {formatDate(week.weekStart, { month: 'short', day: 'numeric' })}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2">
                    {week.status === 'overdue' ? (
                      <Badge tone="warn" dot>
                        behind
                      </Badge>
                    ) : null}
                    {week.status === 'done' ? (
                      <Badge tone="good" dot>
                        done
                      </Badge>
                    ) : null}
                    <span className="font-mono text-xs tabular-nums text-inkfaint">
                      {week.doneTopics}/{week.topics.length} · {formatDuration(week.estimatedMinutes)}
                    </span>
                  </div>
                </div>

                <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                  {week.topics.map((item) => (
                    <li key={item.topic.id} className="flex items-baseline gap-1.5 text-sm">
                      <span className="font-mono text-[11px] text-inkghost">{item.topic.code}</span>
                      <Link
                        href={`/courses/${course.slug}/topics/${item.topic.code}`}
                        className={`underline-offset-2 hover:text-accent hover:underline ${
                          item.done ? 'text-inkghost line-through' : 'text-inksoft'
                        }`}
                      >
                        {item.topic.title}
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="mt-2.5">
                  <Meter
                    value={week.doneTopics}
                    max={Math.max(week.topics.length, 1)}
                    label={`Week ${week.index + 1} completion`}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <Card>
        <CardBody className="py-4">
          <p className="eyebrow mb-1.5">How the times are estimated</p>
          <p className="max-w-3xl text-sm leading-relaxed text-inksoft">
            Each topic is budgeted at its lesson length plus about three minutes per practice
            question, with a 15% allowance for re-reading and notes — so topic{' '}
            {course.topics[0]?.code ?? '1.1'} is roughly{' '}
            {formatDuration(estimateTopic(course.topics[0]!))}. These are planning figures, not
            measurements: your actual time comes from the study timer, and the two are never
            confused.
          </p>
          {!pacing ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-inksoft">
              <AlertTriangle size={14} className="text-ochre" aria-hidden="true" />
              This is a suggested plan. Save it above to make it yours and to track whether you
              are keeping to it.
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
