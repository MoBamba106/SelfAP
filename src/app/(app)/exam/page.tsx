import Link from 'next/link';
import { ExternalLink, Timer } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { getCourseRollups, getEnrollments, getTopicStrengths } from '@/lib/data/repository';
import { courseTint } from '@/lib/utils/format';
import { daysUntil, formatDate } from '@/lib/utils/time';
import { MASTERY_LABEL } from '@/lib/utils/mastery';
import { Badge, Button, Card, CardBody, EmptyState, MasteryMeter } from '@/components/ui/primitives';

export const metadata = { title: 'Exam prep' };

export default async function ExamPage() {
  const user = await requireUser();
  const [enrollments, rollups] = await Promise.all([getEnrollments(user.id), getCourseRollups(user.id)]);
  const now = new Date();

  const strengths = await Promise.all(
    enrollments.map(async (enrollment) => ({
      enrollment,
      ...(await getTopicStrengths(user.id, enrollment.course)),
    })),
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-1.5">Exam prep</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Know the paper you are sitting
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inksoft">
          Format, weighting and the free-response types, next to where you actually stand.
          SelfAP is not affiliated with or endorsed by the College Board — formats below are
          summarised from the published course and exam descriptions, and the official documents
          are linked from each course.
        </p>
      </header>

      {enrollments.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Add a course and its exam format will appear here with your readiness against it."
          action={
            <Button href="/courses" variant="primary">
              Browse courses
            </Button>
          }
        />
      ) : (
        <ul className="space-y-6">
          {enrollments.map((enrollment) => {
            const course = enrollment.course;
            const rollup = rollups.get(course.id);
            const strength = strengths.find((s) => s.enrollment.course.id === course.id);
            const remaining = daysUntil(course.exam.date, now);
            const weakTotal = strength?.weak.length ?? 0;

            return (
              <li
                key={course.id}
                className="card card-spine"
                style={courseTint(course.accent)}
              >
                <div className="border-b border-linesoft px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-ink">{course.code}</h2>
                      <p className="mt-1 text-sm text-inksoft">{course.exam.summary}</p>
                    </div>
                    {course.exam.date ? (
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-semibold tabular-nums text-ink">
                          {formatDate(course.exam.date, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-[11px] text-inkfaint">
                          {remaining === null
                            ? ''
                            : remaining < 0
                              ? 'date passed'
                              : `${remaining} day${remaining === 1 ? '' : 's'} away`}
                          {course.exam.provisional ? ' · provisional' : ''}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <CardBody className="space-y-5">
                  {/* ------------------------------------------------ format */}
                  <div>
                    <p className="eyebrow mb-2">Format</p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[26rem] border-collapse text-sm">
                        <caption className="sr-only">{course.code} exam structure</caption>
                        <thead>
                          <tr className="border-b border-line text-left">
                            <th scope="col" className="py-2 pr-3 text-[10.5px] font-semibold uppercase tracking-wide text-inkghost">
                              Section
                            </th>
                            <th scope="col" className="py-2 pr-3 text-[10.5px] font-semibold uppercase tracking-wide text-inkghost">
                              Questions
                            </th>
                            <th scope="col" className="py-2 pr-3 text-[10.5px] font-semibold uppercase tracking-wide text-inkghost">
                              Time
                            </th>
                            <th scope="col" className="py-2 text-right text-[10.5px] font-semibold uppercase tracking-wide text-inkghost">
                              Weight
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {course.exam.sections.map((section) => (
                            <tr key={section.name} className="border-b border-linesoft last:border-0">
                              <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">
                                {section.name}
                              </th>
                              <td className="py-2 pr-3 font-mono text-xs text-inksoft">{section.count}</td>
                              <td className="py-2 pr-3 font-mono text-xs text-inksoft">{section.time}</td>
                              <td className="py-2 text-right font-mono text-xs tabular-nums text-ink">
                                {section.weight}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {course.exam.durationMinutes ? (
                      <p className="mt-2 text-xs text-inkfaint">
                        Total {course.exam.durationMinutes} minutes including reading and breaks.
                      </p>
                    ) : null}
                  </div>

                  {/* --------------------------------------------------- FRQ */}
                  {course.exam.frqs.length ? (
                    <div>
                      <p className="eyebrow mb-2">Free response</p>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {course.exam.frqs.map((frq) => (
                          <li key={frq.label ?? frq.title} className="well px-3.5 py-2.5">
                            <p className="text-sm font-semibold text-ink">
                              {frq.label ? (
                                <span className="mr-1.5 font-mono text-[11px] text-inkghost">{frq.label}</span>
                              ) : null}
                              {frq.title}
                            </p>
                            {frq.minutes ? (
                              <p className="mt-0.5 font-mono text-[11px] text-inkfaint">
                                {frq.minutes} min
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* --------------------------------------------- readiness */}
                  <div className="border-t border-linesoft pt-4">
                    <p className="eyebrow mb-2.5">Where you stand</p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="mb-1 text-[10.5px] uppercase tracking-wide text-inkghost">
                          Curriculum covered
                        </p>
                        <MasteryMeter
                          rung={Math.max(
                            1,
                            Math.min(5, Math.round(((rollup?.completion ?? 0) / 100) * 5)),
                          )}
                          label={`${rollup?.completion ?? 0}% covered`}
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-[10.5px] uppercase tracking-wide text-inkghost">
                          Practice accuracy
                        </p>
                        <p className="font-mono text-2xl tabular-nums text-ink">
                          {rollup?.accuracy !== null && rollup?.accuracy !== undefined
                            ? `${Math.round(rollup.accuracy * 100)}%`
                            : '—'}
                        </p>
                        <p className="text-[11px] text-inkfaint">
                          {rollup?.practiceTotal ?? 0} attempts
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-[10.5px] uppercase tracking-wide text-inkghost">
                          Still weak
                        </p>
                        <p className="font-mono text-2xl tabular-nums text-ink">{weakTotal}</p>
                        <p className="text-[11px] text-inkfaint">topics below 70%</p>
                      </div>
                    </div>

                    {strength?.weak.length ? (
                      <div className="mt-3">
                        <p className="mb-1.5 text-[10.5px] uppercase tracking-wide text-inkghost">
                          Close these first
                        </p>
                        <ul className="flex flex-wrap gap-1.5">
                          {strength.weak.slice(0, 8).map(({ topic }) => (
                            <li key={topic.id}>
                              <Link
                                href={`/courses/${course.slug}/topics/${topic.code}`}
                                className="badge badge-bad hover:brightness-95"
                              >
                                {topic.code} {topic.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

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
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-linesoft pt-4">
                    <Button href={`/practice/${course.slug}?mode=timed`} variant="primary">
                      <Timer size={14} aria-hidden="true" />
                      Timed block
                    </Button>
                    <Button href={`/practice/${course.slug}?mode=weak`}>Weak areas</Button>
                    <Button href={`/courses/${course.slug}`}>Open course</Button>
                  </div>

                  {course.externalResources.length ? (
                    <div className="border-t border-linesoft pt-4">
                      <p className="eyebrow mb-2">Official resources (external)</p>
                      <ul className="space-y-1.5">
                        {course.externalResources.map((resource) => (
                          <li key={resource.url}>
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-accent underline underline-offset-2 hover:brightness-110"
                            >
                              {resource.label}
                              <ExternalLink size={12} aria-hidden="true" />
                            </a>
                            <span className="ml-2 font-mono text-[10.5px] text-inkghost">
                              {resource.kind}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[11px] leading-relaxed text-inkfaint">
                        These open on the publisher&rsquo;s own site. SelfAP does not host, mirror
                        or redistribute official exam material.
                      </p>
                    </div>
                  ) : null}
                </CardBody>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <CardBody className="py-4">
          <p className="eyebrow mb-1.5">A note on practice material</p>
          <p className="max-w-3xl text-sm leading-relaxed text-inksoft">
            Every question in SelfAP is original, written to the published question types and
            rubrics. Nothing is reproduced from a past exam. Past papers are the single best
            predictor of your score — sit them under real timing from the official sources linked
            above, and use SelfAP to fix the topics they expose.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
