import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { globalSearch } from '@/lib/data/repository';
import { Button, Card, CardBody, EmptyState } from '@/components/ui/primitives';

const KIND_LABEL: Record<string, string> = {
  topic: 'Topic',
  lesson: 'Lesson',
  note: 'Your note',
  course: 'Course',
  unit: 'Unit',
};

export const metadata = { title: 'Search' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const results = query.length >= 2 ? await globalSearch(user.id, query) : [];

  const grouped = new Map<string, typeof results>();
  for (const result of results) {
    const list = grouped.get(result.kind) ?? [];
    list.push(result);
    grouped.set(result.kind, list);
  }
  const order = ['note', 'topic', 'lesson', 'course', 'unit'];
  const kinds = [...grouped.keys()].sort(
    (a, b) => (order.indexOf(a) + 99) % 99 - ((order.indexOf(b) + 99) % 99),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="eyebrow mb-1.5">Search</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Find it in one place
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-inksoft">
          Topics, lessons and your own notes, searched together. Every result shows where it came
          from so you can get back to the wider context.
        </p>
      </header>

      <form action="/search" role="search" className="flex gap-2">
        <label className="sr-only" htmlFor="q">
          Search topics, lessons and notes
        </label>
        <input
          id="q"
          name="q"
          type="search"
          className="input"
          defaultValue={query}
          placeholder="Try “confidence interval” or “ethos”"
          autoFocus={!query}
          autoComplete="off"
        />
        <Button type="submit" variant="primary">
          Search
        </Button>
      </form>

      {!query ? (
        <EmptyState
          title="Start typing"
          description="Two characters is enough. Search covers the whole curriculum you have added, plus every note you have written."
        />
      ) : query.length < 2 ? (
        <p className="text-sm text-inksoft">Type at least two characters.</p>
      ) : results.length === 0 ? (
        <Card>
          <CardBody className="py-6 text-center">
            <p className="font-display text-lg font-semibold text-ink">
              Nothing matches “{query}”
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-inksoft">
              Try a shorter or plainer phrase — the search matches titles and summaries, not full
              lesson text. If you were looking for something you wrote, check the wording of the
              note title.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <p className="text-sm text-inksoft">
            {results.length} result{results.length === 1 ? '' : 's'} for “
            <span className="font-semibold text-ink">{query}</span>”
          </p>

          {kinds.map((kind) => (
            <section key={kind} aria-labelledby={`kind-${kind}`}>
              <h2 id={`kind-${kind}`} className="rule-label mb-3 font-display text-lg font-semibold text-ink">
                {KIND_LABEL[kind] ?? kind}
                <span className="ml-2 font-mono text-xs font-normal text-inkfaint">
                  {grouped.get(kind)!.length}
                </span>
              </h2>
              <ul className="space-y-2">
                {grouped.get(kind)!.map((result) => (
                  <li key={`${result.kind}-${result.id}`}>
                    <Link
                      href={result.href}
                      className="card block px-4 py-3 transition-all duration-150 hover:-translate-y-[1px] hover:border-accent hover:shadow-card"
                    >
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="font-semibold text-ink">{result.title}</span>
                      </span>
                      {result.subtitle ? (
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-inkfaint">
                          {result.subtitle}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
