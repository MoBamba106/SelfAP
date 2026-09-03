import Link from 'next/link';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-16 text-center">
      <p className="eyebrow mb-3">Error 404</p>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        That page is not here
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-inksoft">
        The link may be mistyped, or the thing you were looking for moved. If you got here from
        inside the app, tell us through the contact page and we will fix the link.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link href="/home" className="btn btn-primary">
          Back to dashboard
        </Link>
        <Link href="/courses" className="btn">
          Browse courses
        </Link>
        <Link href="/search" className="btn btn-quiet">
          Search instead
        </Link>
      </div>

      <p className="mt-10 text-xs text-inkfaint">
        SelfAP is not affiliated with, or endorsed by, the College Board.
      </p>
    </main>
  );
}
