import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED = [
  '/home',
  '/courses',
  '/study',
  '/practice',
  '/progress',
  '/planner',
  '/notes',
  '/learn',
  '/exam',
  '/settings',
  '/search',
];
const AUTH_PAGES = ['/login', '/signup', '/forgot-password', '/reset-password'];

/**
 * The proxy runs on every request and does two jobs:
 *   1. keep the Supabase session cookie fresh on every request
 *   2. gate the app shell — unauthenticated visitors are sent to sign-in,
 *      signed-in visitors are sent away from the auth pages
 *
 * This is a convenience, not the security boundary. Even if the proxy were
 * removed entirely, Row Level Security would still return zero rows for an
 * unauthenticated request.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anon && process.env.NEXT_PUBLIC_DEMO !== '1') {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    });
    // Reading the user triggers a token refresh when the access token is stale.
    await supabase.auth.getUser();
  }

  const { pathname } = request.nextUrl;
  const isDemo = process.env.NEXT_PUBLIC_DEMO === '1' || (!url && !anon);
  const hasSession = isDemo
    ? request.cookies.get('selfap_demo')?.value === '1'
    : request.cookies.getAll().some((c) => c.name.includes('auth-token'));

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !hasSession) {
    const target = new URL('/login', request.url);
    target.searchParams.set('next', pathname);
    return NextResponse.redirect(target);
  }
  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
