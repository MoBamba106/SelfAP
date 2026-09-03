import { BookMarked, FileText, ScrollText } from 'lucide-react';
import type { Course } from '@/content';
import { Card, CardBody } from '@/components/ui/primitives';

/**
 * Course-specific tools.
 *
 * Rather than hard-coding "statistics gets a formula sheet", each course
 * declares the tools it wants in its content file and this renders them.
 * A science AP could declare a periodic-table tool; a language AP could
 * declare a grammar reference — no schema change needed.
 */
export function CourseTools({ course }: { course: Course }) {
  const hasReference = course.tools.includes('reference') && course.reference.length > 0;
  const hasFrq = course.tools.includes('frq') && course.exam.frqs.some((f) => f.prompt);
  const hasWorks = course.tools.includes('works') && Boolean(course.suggestedWorks?.length);

  if (!hasReference && !hasFrq && !hasWorks) return null;

  return (
    <section aria-labelledby="tools-heading" className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Subject tools</p>
        <h2 id="tools-heading" className="font-display text-2xl font-semibold text-ink">
          Built for {course.shortName}
        </h2>
      </div>

      {hasReference ? (
        <Card>
          <div className="border-b border-linesoft px-4 py-3 sm:px-5">
            <p className="eyebrow mb-1">Reference</p>
            <h3 className="font-display text-lg font-semibold text-ink">
              <ScrollText size={15} className="mr-1.5 inline text-accent" aria-hidden="true" />
              Reference sheet
            </h3>
          </div>
          <CardBody className="grid gap-6 sm:grid-cols-2">
            {course.reference.map((group) => (
              <div key={group.group}>
                <p className="eyebrow mb-2.5">{group.group}</p>
                <dl className="space-y-2">
                  {group.entries.map((entry) => (
                    <div key={entry.term} className="border-l-2 border-linesoft pl-3">
                      <dt className="text-sm font-semibold text-ink">{entry.term}</dt>
                      <dd className="mt-0.5 font-mono text-xs leading-relaxed text-inksoft">
                        {entry.expression}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {hasFrq ? (
        <Card>
          <div className="border-b border-linesoft px-4 py-3 sm:px-5">
            <p className="eyebrow mb-1">Exam practice</p>
            <h3 className="font-display text-lg font-semibold text-ink">
              <FileText size={15} className="mr-1.5 inline text-accent" aria-hidden="true" />
              Free-response prompts
            </h3>
          </div>
          <CardBody className="space-y-5">
            {course.exam.frqs
              .filter((frq) => frq.prompt)
              .map((frq) => (
                <details key={frq.label ?? frq.title} className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge badge-accent">{frq.label ?? frq.kind ?? 'FRQ'}</span>
                      <span className="text-sm font-semibold text-ink group-hover:text-accent">
                        {frq.title}
                      </span>
                      {frq.minutes ? (
                        <span className="badge ml-auto">{frq.minutes} min</span>
                      ) : null}
                    </div>
                  </summary>
                  <div className="mt-3 space-y-3 border-l-2 border-linesoft pl-4">
                    <p className="text-sm leading-relaxed text-inksoft">{frq.prompt}</p>
                    {frq.rubric?.length ? (
                      <div>
                        <p className="eyebrow mb-1.5">What full credit needs</p>
                        <ul className="space-y-1">
                          {frq.rubric.map((line, i) => (
                            <li key={i} className="text-xs leading-relaxed text-inkfaint">
                              · {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </details>
              ))}
            <p className="text-xs leading-relaxed text-inkfaint">
              These prompts are original to SelfAP and written to the published question
              types. They are not past exam questions.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {hasWorks && course.suggestedWorks ? (
        <Card>
          <div className="border-b border-linesoft px-4 py-3 sm:px-5">
            <p className="eyebrow mb-1">Reading</p>
            <h3 className="font-display text-lg font-semibold text-ink">
              <BookMarked size={15} className="mr-1.5 inline text-accent" aria-hidden="true" />
              Works worth knowing deeply
            </h3>
          </div>
          <CardBody>
            {course.worksNote ? (
              <p className="mb-4 max-w-prose text-sm leading-relaxed text-inksoft">
                {course.worksNote}
              </p>
            ) : null}
            <ul className="grid gap-3 sm:grid-cols-2">
              {course.suggestedWorks.map((work) => (
                <li key={work.title} className="well px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{work.title}</p>
                  <p className="text-xs text-inkfaint">
                    {work.author} · {work.form}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-inksoft">{work.why}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </section>
  );
}
