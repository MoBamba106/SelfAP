import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, hasSupabase } from './env';

/**
 * Request-scoped server Supabase client. Cookies are read and written
 * through Next's cookie store so token refresh works inside Server
 * Components and Server Actions.
 */
export async function createSupabaseServerClient() {
  const store = await cookies();

  if (!hasSupabase()) {
    return createServerClient('http://127.0.0.1:54321', 'demo-anon-key', {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    });
  }

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Middleware refreshes the session in that case, so this is safe.
        }
      },
    },
  });
}
