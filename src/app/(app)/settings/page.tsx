import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { accountSummary } from '@/lib/actions/workspace';
import { getEnrollments, getProfile, getTotals } from '@/lib/data/repository';
import { courseTint } from '@/lib/utils/format';
import { formatDuration, formatGoal } from '@/lib/utils/time';
import { DangerZone, DataExport, ProfileForm } from '@/components/settings/settings-forms';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { GoalEditor } from '@/components/settings/goal-editor';
import { Card, CardBody } from '@/components/ui/primitives';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser();
  const [profile, enrollments, summary, totals] = await Promise.all([
    getProfile(user.id),
    getEnrollments(user.id),
    accountSummary(),
    getTotals(user.id, new Date()),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-1.5">Settings</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Your workspace
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inksoft">
          Signed in as <span className="font-mono text-ink">{summary.email}</span>. You have logged{' '}
          {formatDuration(totals.totalSeconds)} across {totals.sessions} sessions.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm
          displayName={profile?.displayName ?? 'Student'}
          timezone={profile?.timezone ?? 'UTC'}
          weekStartDay={profile?.weekStartDay ?? 1}
          examYear={profile?.examYear ?? null}
        />

        <Card>
          <div className="border-b border-linesoft px-4 py-3 sm:px-5">
            <p className="eyebrow mb-1">Appearance</p>
            <h2 className="font-display text-lg font-semibold text-ink">Theme</h2>
          </div>
          <CardBody>
            <ThemeToggle />
            <p className="hint mt-3">
              Your choice is stored in this browser and applied before first paint, so there is no
              flash of the wrong theme. Motion follows your system setting — with reduced motion
              enabled, animations are turned off throughout the app.
            </p>
          </CardBody>
        </Card>

        <Card>
          <div className="border-b border-linesoft px-4 py-3 sm:px-5">
            <p className="eyebrow mb-1">Goals</p>
            <h2 className="font-display text-lg font-semibold text-ink">Weekly study targets</h2>
          </div>
          <CardBody>
            {enrollments.length === 0 ? (
              <p className="text-sm leading-relaxed text-inksoft">
                You have not added a course yet. Add one from{' '}
                <Link href="/courses" className="text-accent underline underline-offset-2">
                  Courses
                </Link>{' '}
                and set a weekly target here.
              </p>
            ) : (
              <ul className="space-y-3">
                {enrollments.map((enrollment) => (
                  <li
                    key={enrollment.course.id}
                    className="well px-3.5 py-3"
                    style={courseTint(enrollment.course.accent)}
                  >
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{enrollment.course.code}</span>
                      <span className="font-mono text-xs text-inkfaint">
                        current target {formatGoal(enrollment.weeklyGoalMinutes)}
                      </span>
                    </div>
                    <GoalEditor
                      courseId={enrollment.course.id}
                      initial={enrollment.weeklyGoalMinutes}
                    />
                  </li>
                ))}
              </ul>
            )}
            <p className="hint mt-3">
              A target is a floor, not a quota. Missing it does not erase anything — the week just
              shows as short, and the history stays intact.
            </p>
          </CardBody>
        </Card>

        <DataExport />
      </div>

      <DangerZone summary={summary} />

      <Card>
        <CardBody className="py-4">
          <p className="eyebrow mb-1.5">Privacy in one paragraph</p>
          <p className="max-w-3xl text-sm leading-relaxed text-inksoft">
            Every row of your data carries your user id, and row-level security in Postgres is what
            keeps it that way — no part of the app reads another person&apos;s rows, and the
            application never holds a key that could bypass that. Content is published read-only;
            editing it requires an admin role you do not have and cannot grant yourself. See the{' '}
            <a href="/privacy" className="text-accent underline underline-offset-2">
              privacy policy
            </a>{' '}
            for the full picture.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
