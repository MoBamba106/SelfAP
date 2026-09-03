/**
 * Environment access for Supabase. Kept in one place so it is obvious which
 * values are public and which are secret.
 *
 *   NEXT_PUBLIC_SUPABASE_URL       public — safe in the browser
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  public — safe in the browser, RLS enforces access
 *   SUPABASE_SERVICE_ROLE_KEY      SECRET — server-only, bypasses RLS
 *
 * The service-role key is never read from a module that can be bundled for
 * the client: `lib/supabase/admin.ts` imports `server-only`.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO === '1';

/** True when a real Supabase project is wired up. */
export function hasSupabase(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** The backend the app should use. Demo mode wins only when explicitly asked for. */
export function backendKind(): 'supabase' | 'demo' {
  if (DEMO_MODE) return 'demo';
  return hasSupabase() ? 'supabase' : 'demo';
}
