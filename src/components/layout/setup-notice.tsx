import Link from 'next/link';
import { hasSupabase, backendKind } from '@/lib/supabase/env';

/**
 * Shown whenever the app is running without a Supabase project behind it.
 *
 * The in-memory store exists so the product can be reviewed and demoed
 * without credentials. It is not a deployment: nothing survives a restart,
 * every visitor shares one account, and there is no real authentication.
 * That should be impossible to miss, so this renders on every page of the
 * app shell — including on mobile, where the header badge is too small.
 *
 * The header carries a compact version of the same signal; this is the
 * explanation.
 */
export function SetupNotice() {
  if (hasSupabase()) return null;

  return (
    <div
      role="status"
      className="no-print border-b border-line bg-[var(--warn-soft)] px-4 py-2 sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-2 gap-y-1 text-[12.5px] leading-snug text-ink">
        <span className="font-semibold">No database connected.</span>
        <span className="text-inksoft">
          {backendKind() === 'demo'
            ? 'SelfAP is running against an in-memory store: nothing is saved, there is one shared account, and sign-in is not real.'
            : 'The Supabase project is not reachable from this process.'}
        </span>
        <Link
          href="/setup"
          className="font-semibold text-accent-dark underline underline-offset-2 hover:text-accent"
        >
          Connect Supabase
        </Link>
      </div>
    </div>
  );
}

/** Compact marker for the header. Rendered for signed-out and signed-in alike. */
export function DemoBadge() {
  if (backendKind() !== 'demo') return null;
  return (
    <Link
      href="/setup"
      title="Running without a database — open the setup guide"
      className="badge badge-ochre no-print hidden sm:inline-flex"
    >
      Demo data
    </Link>
  );
}
