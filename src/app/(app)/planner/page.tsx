import { requireUser } from '@/lib/auth/session';
import { COURSE_BY_ID } from '@/content';
import {
  getCourseWeeks,
  getEnrollments,
  getProfile,
  getRecentSessions,
  getRecommendation,
  getTopicProgressMap,
  getTotals,
  isoWeekStartFromUser,
  listPacing,
  listPlans,
} from '@/lib/data/repository';
import { buildSchedule } from '@/lib/pacing/schedule';
import { parseIsoDate, weekStart } from '@/lib/utils/time';
import { courseTint } from '@/lib/utils/format';
import { formatDuration, formatGoal } from '@/lib/utils/time';
import { PlanForm, PlanRow, type PlanCourseOption } from '@/components/planner/plan-manager';
import { SuggestedNext } from '@/components/home/suggested-next';
import { Button, Card, CardBody, EmptyState, Meter } from '@/components/ui/primitives';

export const metadata = { title: 'Planner' };

export default async function PlannerPage() {
  const user = await requireUser();
  const now = new Date();

  const [enrollments, plans, weeks, recommendation, totals, recent, weekStartIso, profile, pacingMap] =
    await Promise.all([
      getEnrollments(user.id),
      listPlans(user.id),
      getCourseWeeks(user.id, now),
      getRecommendation(user.id),
      getTotals(user.id, now),
      getRecentSessions(user.id, 60),
      isoWeekStartFromUser(user.id, now),
      getProfile(user.id),
      listPacing(user.id),
    ]);

  const weekStartAt = new Date(weekStartIso);
  const weekSessions = recent.filter((session) => session.startedAt >= weekStartAt).length;

  const courseOptions: PlanCourseOption[] = enrollments.map((e) => ({
    id: e.course.id,
    code: e.course.code,
    units: e.course.units.map((u) => ({ id: u.id, code: u.code })),
  }));

  const weekStartDay = profile?.weekStartDay ?? 1;
  const progressMaps = await Promise.all(
    enrollments.map((e) => getTopicProgressMap(user.id, [e.course.id])),
  );

  const schedules = enrollments.map((enrollment, i) => {
    const pacing = pacingMap.get(enrollment.course.id) ?? null;
    const doneTopicIds = new Set(
      enrollment.course.topics
        .filter((t) => progressMaps[i]?.get(t.id)?.lessonDone)
        .map((t) => t.id),
    );
    const defaultEnd = enrollment.course.exam.date
      ? parseIsoDate(enrollment.course.exam.date)
      : new Date(now.getTime() + 84 * 86_400_000);
    return {
      enrollment,
      pacing,
      schedule: buildSchedule(
        enrollment.course,
        {
          startDate: pacing ? parseIsoDate(pacing.startDate) : weekStart(now, weekStartDay),
          endDate: pacing ? parseIsoDate(pacing.endDate) : defaultEnd,
          weeklyMinutes: pacing?.weeklyMinutes ?? enrollment.weeklyGoalMinutes,
          mode: pacing?.mode ?? 'calendar',
          weekStartDay,
          today: now,
        },
        doneTopicIds,
      ),
    };
  });

  const datedGoals = plans.filter((p) => p.kind === 'goal');
  const rhythms = plans.filter((p) => p.kind === 'weekly');

  const plannedMinutes = rhythms.reduce(
    (sum, plan) => sum + plan.template.reduce((s, t) => s + t.minutes, 0),
    0,
  );
  const goalMinutes = weeks.reduce((sum, w) => sum + w.goalMinutes, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">Planner</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Decide the week before it happens
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inksoft">
            Two kinds of plan: a dated goal you are working towards, and a weekly rhythm you repeat.
            Neither is a timetable the app enforces — they exist so the dashboard can tell you
            whether the shape you chose is actually happening.
          </p>
        </div>
        <PlanForm courses={courseOptions} />
      </header>

      {recommendation ? (
        <div style={courseTint(recommendation.course.accent)}>
          <SuggestedNext rec={recommendation} />
        </div>
      ) : null}

      {/* --------------------------------------------- plan vs reality */}
      <Card>
        <div className="border-b border-linesoft px-4 py-3 sm:px-5">
          <p className="eyebrow mb-1">This week</p>
          <h2 className="font-display text-lg font-semibold text-ink">Planned against actual</h2>
        </div>
        <CardBody>
          <dl className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
            <div>
              <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">Logged so far</dt>
              <dd className="mt-1 font-mono text-xl tabular-nums text-ink">
                {formatDuration(totals.weekSeconds)}
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">Course targets</dt>
              <dd className="mt-1 font-mono text-xl tabular-nums text-ink">
                {formatGoal(goalMinutes)}
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">Weekly rhythm</dt>
              <dd className="mt-1 font-mono text-xl tabular-nums text-ink">
                {plannedMinutes ? formatGoal(plannedMinutes) : 'not set'}
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">Sessions</dt>
              <dd className="mt-1 font-mono text-xl tabular-nums text-ink">{weekSessions}</dd>
            </div>
          </dl>

          {weeks.length ? (
            <ul className="mt-5 space-y-2.5 border-t border-linesoft pt-4">
              {weeks.map((week) => (
                <li key={week.course.id} style={courseTint(week.course.accent)}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-ink">{week.course.shortName}</span>
                    <span className="font-mono text-xs text-inkfaint">
                      {formatDuration(week.seconds)} / {formatGoal(week.goalMinutes)}
                    </span>
                  </div>
                  <Meter
                    value={week.seconds}
                    max={Math.max(week.goalMinutes * 60, 1)}
                    label={`${week.course.shortName} weekly goal`}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </CardBody>
      </Card>

      {/* --------------------------------------------------- schedules */}
      <section aria-labelledby="schedules" className="space-y-3">
        <div className="rule-label">
          <h2 id="schedules" className="font-display text-xl font-semibold text-ink">
            Pacing schedules
          </h2>
        </div>
        {enrollments.length === 0 ? (
          <p className="text-sm leading-relaxed text-inksoft">
            Add a course and you can spread its topics across a calendar.
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {schedules.map(({ enrollment, pacing, schedule }) => (
              <li
                key={enrollment.course.id}
                className="card card-spine px-4 py-3.5 sm:px-5"
                style={courseTint(enrollment.course.accent)}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-ink">
                    {enrollment.course.code}
                  </h3>
                  <span className="font-mono text-xs tabular-nums text-inkfaint">
                    {schedule.percentComplete}% · week{' '}
                    {schedule.currentWeekIndex === null
                      ? '—'
                      : `${schedule.currentWeekIndex + 1}/${schedule.weeks.length}`}
                  </span>
                </div>
                <Meter
                  className="mt-2"
                  value={schedule.percentComplete}
                  max={100}
                  label={`${enrollment.course.shortName} schedule progress`}
                />
                <dl className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-inkghost">Per week</dt>
                    <dd className="mt-0.5 font-mono tabular-nums text-ink">
                      {formatGoal(schedule.weeklyTarget)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-inkghost">Behind</dt>
                    <dd
                      className={`mt-0.5 font-mono tabular-nums ${
                        schedule.behindBy ? 'text-bad' : 'text-good'
                      }`}
                    >
                      {schedule.behindBy} topic{schedule.behindBy === 1 ? '' : 's'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-inkghost">Status</dt>
                    <dd className="mt-0.5 text-ink">
                      {pacing ? 'saved' : 'suggested'}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <Button href={`/courses/${enrollment.course.slug}/plan`} size="sm">
                    Open schedule
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------ plans */}
      <section aria-labelledby="goals" className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 id="goals" className="font-display text-xl font-semibold text-ink">
            Dated goals
          </h2>
          {datedGoals.length ? (
            <ul className="mt-3 space-y-2.5">
              {datedGoals.map((plan) => (
                <PlanRow
                  key={plan.id}
                  plan={plan}
                  courseCode={COURSE_BY_ID.get(plan.courseId)?.code ?? 'Course'}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-inksoft">
              No dated goals yet. Useful when you know the exam date and want a checkpoint — for
              example, &ldquo;finish Unit 3 by 14 March&rdquo;.
            </p>
          )}
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Weekly rhythm</h2>
          {rhythms.length ? (
            <ul className="mt-3 space-y-2.5">
              {rhythms.map((plan) => (
                <PlanRow
                  key={plan.id}
                  plan={plan}
                  courseCode={COURSE_BY_ID.get(plan.courseId)?.code ?? 'Course'}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-inksoft">
              No weekly rhythm yet. A repeated shape — three short weekday sittings and a longer
              weekend block — beats a heroic eight-hour Sunday for retention.
            </p>
          )}
        </div>
      </section>

      {enrollments.length === 0 ? (
        <EmptyState
          title="Add a course to plan against"
          description="Plans are always attached to a course, so the app can tell you what is behind."
          action={
            <Button href="/courses" variant="primary">
              Browse courses
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
