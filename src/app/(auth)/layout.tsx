import Link from 'next/link';

/**
 * Minimal centred shell for the auth screens. No app navigation: there is
 * nothing to navigate to yet, and a header full of links that redirect back
 * here is just noise.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-5 sm:px-8">
        <Link href="/" className="no-tap-flash inline-flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold tracking-tight text-ink">
            Self<span className="text-accent">AP</span>
          </span>
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-4 sm:px-8">
        <div className="w-full max-w-[26rem]">{children}</div>
      </main>

      <footer className="border-t border-linesoft px-5 py-5 text-center text-xs text-inkfaint sm:px-8">
        <p>
          SelfAP is an independent study tool and is not affiliated with, or endorsed by, the
          College Board.
        </p>
      </footer>
    </div>
  );
}
