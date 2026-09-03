'use client';

import { useEffect } from 'react';

/**
 * Root error boundary. Kept deliberately plain and dependency-free: this is
 * the screen that shows up when something else has already gone wrong.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Wire real error reporting in here; a console log is not enough in
    // production, but it is the right default for a self-hosted build.
    console.error('[selfap]', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-16 text-center">
      <p className="eyebrow mb-3">Something broke</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        That did not work
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-inksoft">
        Nothing you did caused this, and nothing you logged has been lost — study sessions are
        written to the database as they happen, not when a page finishes loading.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <a href="/home" className="btn">
          Go to dashboard
        </a>
      </div>

      {error.digest ? (
        <p className="mt-8 font-mono text-[11px] text-inkghost">
          Reference {error.digest} — quote this if you report it.
        </p>
      ) : null}
    </main>
  );
}
