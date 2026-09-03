/**
 * Runs once when the server starts.
 *
 * Its only job is to make a misconfigured deployment loud in the logs. Without
 * Supabase credentials the app falls back to an in-memory store so it can still
 * be reviewed — useful on a laptop, and quietly wrong on a real deployment,
 * where it looks like a working site that forgets everything on restart.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anon) return;

  const lines = [
    '',
    'SelfAP: no Supabase project is configured.',
    '  Falling back to an in-memory store — nothing is persisted and',
    '  authentication is not real. Fine for local review, wrong for a deployment.',
    '  Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    '  See /setup for the full runbook.',
    '',
  ];

  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    console.error(lines.join('\n'));
  } else {
    console.warn(lines.join('\n'));
  }
}
