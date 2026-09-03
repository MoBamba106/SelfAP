import 'server-only';
import { backendKind } from '@/lib/supabase/env';
import type { Backend } from './backend';
import { demoBackend } from './backend-demo';

export * from './backend';
export { DEMO_USER_ID } from './backend-demo';

/**
 * Resolve the active backend once per request. In demo mode this is the
 * in-memory store; otherwise it is the request-scoped Supabase client.
 */
export async function db(): Promise<Backend> {
  if (backendKind() === 'demo') return demoBackend;
  const { supabaseBackend } = await import('./backend-supabase');
  return supabaseBackend();
}
