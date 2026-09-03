import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { COURSES } from '@/content';
import { getCourseRollups, getEnrollments } from '@/lib/data/repository';
import { courseTint } from '@/lib/utils/format';
import { formatDuration } from '@/lib/utils/time';
import { CourseCard } from '@/components/course/course-card';

export const metadata = { title: 'Courses' };

export default async function CoursesPage() {
  const user = await requireUser();
  const [enrollments, rollups] = await Promise.all([
    getEnrollments(user.id),
    getCourseRollups(user.id),
  ]);
  const enrolled = new Set(enrollments.map((e) => e.courseId));

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-1.5">Courses</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          AP courses
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inksoft">
          Every course maps the published AP framework into units and topics, with a lesson
          and practice attached to each. Adding a subject later is a content file, not a
          rebuild — the structure below scales to any AP course.
        </p>
      </header>

      <section aria-labelledby="enrolled-heading">
        <h2 id="enrolled-heading" className="eyebrow mb-3">
          Your workspace
        </h2>
        {enrollments.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((enrollment) => (
              <CourseCard
                key={enrollment.course.id}
                course={enrollment.course}
                rollup={rollups.get(enrollment.course.id) ?? null}
                weeklyGoalMinutes={enrollment.weeklyGoalMinutes}
              />
            ))}
          </ul>
        ) : (
          <p className="card px-5 py-4 text-sm text-inksoft">
            You have not added a course yet. Pick one below to build your workspace.
          </p>
        )}
      </section>

      <section aria-labelledby="all-heading">
        <h2 id="all-heading" className="eyebrow mb-3">
          All available courses
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COURSES.map((course) => {
            const isEnrolled = enrolled.has(course.id);
            return (
              <li
                key={course.slug}
                className="card card-spine flex flex-col px-5 py-4"
                style={courseTint(course.accent)}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold leading-tight text-ink">
                    {course.code}
                  </h3>
                  {isEnrolled ? <span className="badge badge-good">Enrolled</span> : null}
                </div>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-inksoft">{course.tagline}</p>

                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-linesoft pt-3 text-center">
                  <div>
                    <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">Units</dt>
                    <dd className="mt-0.5 font-display text-base font-semibold tabular-nums text-ink">
                      {course.units.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">Topics</dt>
                    <dd className="mt-0.5 font-display text-base font-semibold tabular-nums text-ink">
                      {course.topicCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] uppercase tracking-wide text-inkghost">Lessons</dt>
                    <dd className="mt-0.5 font-display text-base font-semibold tabular-nums text-ink">
                      {course.lessonCount}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/courses/${course.slug}`} className="btn btn-sm">
                    Browse
                  </Link>
                  {rollups.get(course.id)?.seconds ? (
                    <span className="btn btn-sm btn-quiet pointer-events-none">
                      {formatDuration(rollups.get(course.id)!.seconds)} logged
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs leading-relaxed text-inkfaint">
        <Plus size={11} className="mr-1 inline" aria-hidden="true" />
        Course structures follow the published AP frameworks as of the 2026–27 school year.
        Where College Board updates a framework, the change is a content edit — see{' '}
        <Link href="/about" className="underline underline-offset-2 hover:text-accent">
          About
        </Link>
        .
      </p>
    </div>
  );
}
