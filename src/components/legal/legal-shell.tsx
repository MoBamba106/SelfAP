import type { ReactNode } from 'react';
import { Card, CardBody } from '@/components/ui/primitives';

/**
 * Shared frame for the policy pages.
 *
 * Every policy carries the same banner: these documents are drafted as
 * working templates and are not a substitute for review by a qualified
 * attorney in the relevant jurisdiction.
 */
export function LegalShell({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="eyebrow mb-1.5">{eyebrow}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-xs text-inkfaint">Last updated {updated}</p>
      </header>

      <div className="callout mb-6" data-kind="warning">
        <span className="callout-label">Template — not legal advice</span>
        <p className="text-sm leading-relaxed text-inksoft">
          This document is a working draft prepared for a product at this stage. It has not been
          reviewed by a qualified attorney and should not be relied on as legal advice. Have it
          reviewed before you rely on it commercially.
        </p>
      </div>

      <div className="prose-legal">
        {children}
      </div>

      <Card className="mt-8">
        <CardBody className="py-4">
          <p className="text-sm leading-relaxed text-inksoft">
            Questions about any of this? Write to us through the{' '}
            <a href="/contact" className="text-accent underline underline-offset-2">
              contact page
            </a>
            .
          </p>
        </CardBody>
      </Card>
    </article>
  );
}

/** Numbered section heading used throughout the policies. */
export function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`s-${n}`} className="mb-6">
      <h2 id={`s-${n}`} className="mb-2 font-display text-xl font-semibold text-ink">
        <span className="mr-2 font-mono text-sm text-inkghost">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
