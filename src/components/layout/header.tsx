import Link from 'next/link';
import { Search } from 'lucide-react';
import { signOut } from '@/lib/actions/auth';
import { getSessionUser } from '@/lib/auth/session';
import { DesktopNav, MobileTabBar } from './app-nav';
import { DemoBadge } from './setup-notice';
import { ThemeToggle } from './theme-toggle';

/** The mark: a ruled sheet with a pencil spine. Drawn, not an icon font. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-[7px] bg-accent text-[#fbf7ef]"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 20 20" fill="none">
        <path d="M3 4.5h14M3 8h14M3 11.5h9M3 15h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M15.5 12.5l2.6 2.6-1.3 1.3-2.6-2.6z" fill="currentColor" opacity=".85" />
      </svg>
    </span>
  );
}

export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-[var(--radius-ctl)] no-underline"
      aria-label="SelfAP home"
    >
      <BrandMark />
      {!compact ? (
        <span className="font-display text-[19px] font-semibold leading-none tracking-tight text-ink">
          Self<span className="text-accent">AP</span>
        </span>
      ) : null}
    </Link>
  );
}

export async function AppHeader() {
  const user = await getSessionUser();

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-[6px]">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Wordmark />

        <DesktopNav className="ml-4" />

        <div className="ml-auto flex items-center gap-1.5">
          <form action="/search" role="search" className="relative hidden sm:block">
            <label htmlFor="global-search" className="sr-only">
              Search courses, topics, lessons and notes
            </label>
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-inkghost"
            />
            <input
              id="global-search"
              name="q"
              type="search"
              placeholder="Search…"
              autoComplete="off"
              className="input h-9 w-40 pl-8 text-[13px] lg:w-56"
            />
          </form>

          <a
            href="/search"
            aria-label="Search"
            className="btn btn-quiet btn-sm px-2 sm:hidden"
          >
            <Search size={16} aria-hidden="true" />
          </a>

          <ThemeToggle />

          <DemoBadge />

          {user ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/settings"
                className="hidden items-center gap-2 rounded-[var(--radius-ctl)] border border-line bg-paper-raised px-2.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-linestrong sm:flex"
              >
                <span
                  aria-hidden="true"
                  className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-[#fbf7ef]"
                >
                  {(user.profile?.displayName || user.email).slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[8rem] truncate">
                  {user.profile?.displayName || 'Account'}
                </span>
              </Link>
              <form action={signOut}>
                <button type="submit" className="btn btn-quiet btn-sm">
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link href="/login" className="btn btn-quiet btn-sm">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm hidden sm:inline-flex">
                Get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export { MobileTabBar };
