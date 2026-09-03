import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { backendKind } from '@/lib/supabase/env';
import { DEMO_USER_ID } from '@/lib/data/backend-demo';
import { getProfile, type Profile } from '@/lib/data/repository';

export interface SessionUser {
  id: string;
  email: string;
  profile: Profile | null;
}

export const DEMO_COOKIE = 'selfap_demo';

/**
 * Resolve the current session.
 *
 * Production: the Supabase JWT in the request cookies.
 * Demo mode : an explicit opt-in cookie, so the sign-in flow is still
 *             exercised rather than silently bypassed.
 *
 * The id returned here is the only value the repository trusts, and every
 * query is scoped by it — but RLS is what actually enforces that.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();

  if (backendKind() === 'demo') {
    if (store.get(DEMO_COOKIE)?.value !== '1') return null;
    const profile = await getProfile(DEMO_USER_ID);
    return { id: DEMO_USER_ID, email: profile?.email ?? 'demo@selfap.app', profile };
  }

  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const profile = await getProfile(user.id);
  return { id: user.id, email: user.email ?? '', profile };
}

/** Redirect to sign-in when there is no session. Used by every app page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/home');
  return user;
}
