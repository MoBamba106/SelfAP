import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SERVICE_ROLE_KEY } from './env';

/**
 * Service-role client. Bypasses Row Level Security and is used ONLY by:
 *   • scripts/seed.mjs (curriculum content)
 *   • the future admin content API, which checks profiles.role = 'admin'
 *
 * It must never be imported from a client component, an API route reachable
 * by an unauthenticated caller, or anything that serialises to the browser.
 */
export function createSupabaseAdminClient() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
