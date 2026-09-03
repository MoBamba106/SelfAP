#!/usr/bin/env node
/**
 * Apply every SQL migration in `supabase/migrations/` to a Supabase project.
 *
 * Dependency-free on purpose: it talks to the Supabase Management API over
 * fetch, so `npm run db:push` works on a fresh clone with no extra install
 * and no database driver.
 *
 * Required environment:
 *   SUPABASE_ACCESS_TOKEN   personal access token (supabase.com/account/tokens)
 *   SUPABASE_PROJECT_REF    the project ref from its dashboard URL
 *
 * Usage:
 *   npm run db:push                 # apply all, in filename order
 *   npm run db:push -- --dry-run    # print what would run, change nothing
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');

const API = 'https://api.supabase.com';

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  const dryRun = process.argv.includes('--dry-run');

  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort();
  if (!files.length) {
    console.error(`No .sql files found in ${MIGRATIONS}`);
    process.exit(1);
  }

  console.log(`${files.length} migration file(s), applied in filename order:`);
  for (const file of files) console.log(`  · ${file}`);

  /* --dry-run needs no credentials: it exists to check ordering before you
   * touch a project. */
  if (dryRun) {
    console.log('\n--dry-run: nothing was sent.');
    return;
  }

  if (!token || !ref) {
    console.error(
      [
        '',
        'Missing environment variables.',
        '',
        '  SUPABASE_ACCESS_TOKEN   create one at https://supabase.com/dashboard/account/tokens',
        '  SUPABASE_PROJECT_REF    the ref in your project URL: /project/<ref>',
        '',
        'Example:',
        '  SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_PROJECT_REF=abcdefghijkl npm run db:push',
      ].join('\n'),
    );
    process.exit(1);
  }

  console.log(`\nProject ${ref}`);

  let applied = 0;
  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS, file), 'utf8');
    process.stdout.write(`\n→ ${file} (${sql.length} bytes) … `);

    const response = await fetch(`${API}/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`FAILED (${response.status})`);
      console.error(body.slice(0, 2000));
      console.error(
        '\nMigrations are idempotent, so re-running after a fix is safe. ' +
          'Fix the file and run again.',
      );
      process.exit(1);
    }

    applied += 1;
    console.log('ok');
  }

  console.log(`\nDone — ${applied} file(s) applied to ${ref}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
