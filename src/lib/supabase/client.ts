import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, hasSupabase } from './env';

/**
 * Browser Supabase client. Used for session refresh and for auth flows that
 * must happen in the browser (password reset links, OAuth callbacks).
 *
 * All study data reads and writes go through server actions instead, so this
 * client holds no privileged credentials — only the anon key, which RLS
 * constrains to the signed-in user's own rows.
 */
export function createSupabaseBrowserClient() {
  if (!hasSupabase()) {
    // Demo mode has no project. Return a client pointed at a harmless local
    // origin so nothing throws during hydration; it is never used for data.
    return createBrowserClient('http://127.0.0.1:54321', 'demo-anon-key');
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
