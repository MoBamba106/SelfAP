import { requireUser } from '@/lib/auth/session';
import {
  getCourseRollups,
  getCourseWeeks,
  getEnrollments,
  getPracticeSummary,
  getTotals,
  getTopicStrengths,
  getWeekHistory,
} from '@/lib/data/repository';
import { courseTint } from '@/lib/utils/format';
import { formatDuration, formatGoal } from '@/lib/utils/time';
import { MASTERY_LABEL } from '@/lib/utils/mastery';
import { WeeklyChart } from '@/components/progress/weekly-chart';
import { Badge, Card, CardBody, EmptyState, Meter, Stat } from '@/components/ui/primitives';

export const metadata = { title: 'Progress' };

export default async function ProgressPage() {
  const user = await requireUser();
  const now = new Date();

  const [totals, weeks, history, rollups, enrollments, practice] = await Promise.all([
    getTotals(user.id, now),
    getCourseWeeks(user.id, now),
    getWeekHistory(user.id, 12, now),
    getCourseRollups(user.id),
    getEnrollments(user.id),
    getPracticeSummary(user.id),
  ]);

  const totalTopics = enrollments.reduce((n, e) => n + e.course.topicCount, 0);
  const mastered = [...rollups.values()].reduce((n, r) => n + r.masteryCounts.mastered, 0);
  const lessonsDone = [...rollups.values()].reduce((n, r) => n + r.lessonsDone, 0);

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-1.5">Progress</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          How it is actually going
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inksoft">
          Everything here is computed from your logged study sessions and practice attempts.
          Nothing is deleted when a week rolls over — the history below is the same data the
          dashboard reads.
        </p>
      </header>

      {/* ---------------------------------------------------- overall */}
      <Card className="px-5 py-5">
        <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Total time" value={formatDuration(totals.totalSeconds)} hint={`${totals.sessions} sessions`} />
          <Stat label="This week" value={formatDuration(totals.weekSeconds)} />
          <Stat label="Streak" value={`${totals.streakDays}d`} hint="consecutive days" />
          <Stat label="Lessons" value={lessonsDone} hint={`of ${totalTopics}`} />
          <Stat label="Mastered" value={mastered} hint={`of ${totalTopics} topics`} />
          <Stat
            label="Accuracy"
            value={practice.accuracy !== null ? `${Math.round(practice.accuracy * 100)}%` : '—'}
            hint={`${practice.total} graded`}
          />
        </div>
      </Card>

      {/* --------------------------------------------------- history */}
      <Card>
        <div className="border-b border-linesoft px-4 py-3 sm:px-5">
          <p className="eyebrow mb-1">Historical study</p>
          <h2 className="font-display text-lg font-semibold text-ink">Last twelve weeks</h2>
        </div>
        <CardBody>
          <WeeklyChart weeks={history} />
          <ul className="mt-4 grid gap-x-6 gap-y-1 border-t border-linesoft pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {history
              .slice()
              .reverse()
              .map((week, index) => (
                <li key={week.weekStart} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-inkfaint">
                    {index === 0 ? 'This week' : `Week of ${week.label}`}
                  </span>
                  <span className="font-mono tabular-nums text-inksoft">
                    {formatDuration(week.seconds)}
                    {week.goalMinutes ? (
                      <span className="text-inkghost"> / {formatGoal(week.goalMinutes)}</span>
                    ) : null}
                  </span>
                </li>
              ))}
          </ul>
        </CardBody>
      </Card>

      {/* -------------------------------------------------- by course */}
      <section aria-labelledby="by-course" className="space-y-4">
        <h2 id="by-course" className="font-display text-2xl font-semibold text-ink">
          By course
        </h2>

        {enrollments.length === 0 ? (
          <EmptyState
            title="No courses yet"
            description="Add a course and your progress will start building from your first session."
          />
        ) : null}

        <ul className="grid gap-4 lg:grid-cols-2">
          {enrollments.map((enrollment) => {
            const rollup = rollups.get(enrollment.course.id);
            const week = weeks.find((w) => w.course.id === enrollment.course.id);
            return (
              <li
                key={enrollment.course.id}
                className="card card-spine px-5 py-4"
                style={courseTint(enrollment.course.accent)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink">
                      {enrollment.course.code}
                    </h3>
                    <p className="mt-0.5 text-xs text-inkfaint">
                      {rollup?.currentUnit
                        ? `Working through Unit ${rollup.currentUnit.code}`
                        : 'All units complete'}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-ink">
                    {rollup?.completion ?? 0}%
                  </span>
                </div>

                <Meter
                  className="mt-3"
                  value={rollup?.completion ?? 0}
                  max={100}
                  label={`${enrollment.course.shortName} curriculum completion`}
                />

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-linesoft pt-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">Hours</dt>
                    <dd className="mt-0.5 tabular-nums text-ink">
                      {formatDuration(rollup?.seconds ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">This week</dt>
                    <dd className="mt-0.5 tabular-nums text-ink">
                      {formatDuration(week?.seconds ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">Accuracy</dt>
                    <dd className="mt-0.5 tabular-nums text-ink">
                      {rollup?.accuracy !== null && rollup?.accuracy !== undefined
                        ? `${Math.round(rollup.accuracy * 100)}%`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">Lessons</dt>
                    <dd className="mt-0.5 tabular-nums text-ink">
                      {rollup?.lessonsDone ?? 0}/{enrollment.course.topicCount}
                    </dd>
                  </div>
                </dl>

                {rollup ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {(['mastered', 'strong', 'practicing', 'learning', 'not-started'] as const).map(
                      (status) =>
                        rollup.masteryCounts[status] ? (
                          <li key={status}>
                            <Badge
                              tone={
                                status === 'mastered'
                                  ? 'good'
                                  : status === 'strong'
                                    ? 'accent'
                                    : status === 'practicing'
                                      ? 'ochre'
                                      : 'muted'
                              }
                            >
                              {rollup.masteryCounts[status]} {MASTERY_LABEL[status].toLowerCase()}
                            </Badge>
                          </li>
                        ) : null,
                    )}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ----------------------------------------------- weak/strong */}
      <section aria-labelledby="areas" className="grid gap-4 lg:grid-cols-2">
        <h2 id="areas" className="sr-only">
          Weak and strong areas
        </h2>
        {await Promise.all(
          enrollments.map(async (enrollment) => {
            const { weak, strong } = await getTopicStrengths(user.id, enrollment.course);
            if (!weak.length && !strong.length) return null;
            return (
              <Card key={enrollment.course.id} spine={enrollment.course.accent}>
                <div className="border-b border-linesoft px-4 py-3 sm:px-5">
                  <p className="eyebrow mb-1">{enrollment.course.shortName}</p>
                  <h3 className="font-display text-lg font-semibold text-ink">Weak and strong</h3>
                </div>
                <CardBody className="space-y-4">
                  {weak.length ? (
                    <div>
                      <p className="eyebrow mb-2 text-bad">Review these</p>
                      <ul className="space-y-1.5">
                        {weak.map(({ topic, progress }) => (
                          <li
                            key={topic.id}
                            className="flex items-baseline justify-between gap-3 text-sm"
                          >
                            <span className="min-w-0 truncate text-inksoft">
                              <span className="font-mono text-xs text-inkghost">{topic.code}</span>{' '}
                              {topic.title}
                            </span>
                            <span className="shrink-0 font-mono text-xs tabular-nums text-bad">
                              {Math.round((progress.mastery.accuracy ?? 0) * 100)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {strong.length ? (
                    <div>
                      <p className="eyebrow mb-2 text-good">Holding well</p>
                      <ul className="space-y-1.5">
                        {strong.map(({ topic, progress }) => (
                          <li
                            key={topic.id}
                            className="flex items-baseline justify-between gap-3 text-sm"
                          >
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
            );
          }),
        )}
      </section>
    </div>
  );
}
