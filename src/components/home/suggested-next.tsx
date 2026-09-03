import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { courseTint } from '@/lib/utils/format';
import type { Recommendation } from '@/lib/data/repository';
import { Button, Card, CardBody, EmptyState } from '@/components/ui/primitives';

/**
 * The recommendation, with its reasons shown. If the app cannot explain
 * itself, it should not be making the suggestion — so the reasoning is
 * part of the component, not a tooltip.
 */
export function SuggestedNext({ rec }: { rec: Recommendation | null }) {
  return (
    <Card>
      <div className="border-b border-linesoft px-4 py-3 sm:px-5">
        <p className="eyebrow mb-1">Suggested next</p>
        <h2 className="font-display text-lg font-semibold text-ink">What to study today</h2>
      </div>

      <CardBody>
        {!rec ? (
          <EmptyState
            title="Nothing queued yet"
            description="Add a course and complete a lesson or two, and SelfAP will start pointing at the next topic."
            action={
              <Button href="/courses" variant="primary" size="sm">
                Browse courses
              </Button>
            }
          />
        ) : (
          <div style={courseTint(rec.course.accent)}>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: 'var(--tint-soft)', color: 'var(--tint)' }}
              >
                {rec.course.shortName} · Unit {rec.unit.code}
              </span>
              <span className="badge">
                {rec.unitProgress.done}/{rec.unitProgress.total} topics done
              </span>
            </div>

            <h3 className="mt-3 font-display text-xl font-semibold leading-snug text-ink">
              Topic {rec.topic.code} — {rec.topic.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-inksoft">{rec.topic.summary}</p>

            {rec.reasons.length ? (
              <div className="mt-4">
                <p className="eyebrow mb-2">Why this one</p>
                <ul className="space-y-1.5">
                  {rec.reasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-2 text-sm text-inksoft">
                      <Check size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button href={rec.href} variant="primary">
                Start studying
                <ArrowRight size={15} aria-hidden="true" />
              </Button>
              <Link
                href={`/courses/${rec.course.slug}/topics/${rec.topic.code}`}
                className="btn"
              >
                Topic overview
              </Link>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
