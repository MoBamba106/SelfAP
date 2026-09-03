import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/primitives';
import { hasSupabase, backendKind } from '@/lib/supabase/env';

export const metadata: Metadata = {
  title: 'Setup — connect Supabase and deploy to Vercel',
  description:
    'How to run SelfAP as a real website: provision Supabase for auth, Postgres and Storage, then deploy the Next.js app to Vercel.',
};

/** Small caption + command block pair, used for every runnable step. */
function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`setup-${n}`} className="mb-7">
      <h2 id={`setup-${n}`} className="mb-2 font-display text-xl font-semibold text-ink">
        <span className="mr-2 font-mono text-sm text-inkghost">{n}</span>
        {title}
      </h2>
      <div className="prose-legal">{children}</div>
    </section>
  );
}

const ENV_VARS = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    where: 'client + server',
    secret: false,
    note: 'Project URL, Settings → API.',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    where: 'client + server',
    secret: false,
    note: 'Safe in the browser. Row Level Security is what actually decides what a session can read.',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    where: 'server only',
    secret: true,
    note: 'Bypasses RLS. Used by npm run seed. Never prefix it with NEXT_PUBLIC_.',
  },
  {
    name: 'SUPABASE_ACCESS_TOKEN',
    where: 'build machine only',
    secret: true,
    note: 'Personal access token for npm run db:push. Not needed at runtime.',
  },
  {
    name: 'SUPABASE_PROJECT_REF',
    where: 'build machine only',
    secret: false,
    note: 'The subdomain of your project URL. Not needed at runtime.',
  },
  {
    name: 'NEXT_PUBLIC_SITE_URL',
    where: 'server',
    secret: false,
    note: 'Absolute origin, used for password-reset redirects. Set it to the Vercel domain.',
  },
  {
    name: 'NEXT_PUBLIC_DEMO',
    where: 'client + server',
    secret: false,
    note: 'Set to 1 to force the in-memory store. Leave unset in production.',
  },
];

export default function SetupPage() {
  const connected = hasSupabase();
  const kind = backendKind();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-6">
        <p className="eyebrow mb-1.5">Deployment</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Run SelfAP as a website
        </h1>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-inksoft">
          SelfAP is a Next.js App Router site. Supabase provides authentication, Postgres and
          Storage; Vercel serves the app. There is no server to administer and nothing to install
          on a machine of your own.
        </p>
      </header>

      <div className="callout mb-8" data-kind={connected ? 'example' : 'warning'}>
        <span className="callout-label">
          {connected ? 'This instance is connected' : 'This instance is not connected'}
        </span>
        <p className="text-sm leading-relaxed text-inksoft">
          {connected
            ? 'A Supabase project is configured, so this deployment stores real data and signs real accounts in.'
            : kind === 'demo'
              ? 'No Supabase project is configured, so this instance is running against an in-memory store. Nothing is saved, every visitor shares one account, and sign-in is not real. Complete the steps below to turn it into a real deployment.'
              : 'The Supabase variables are set but the project could not be reached. Check the URL and the anon key, and confirm the project is not paused.'}
        </p>
      </div>

      <Step n="1" title="Create a Supabase project">
        <p>
          Create a project at <strong>supabase.com</strong>. Note the project URL and the anon key
          from <em>Settings → API</em>, and the service-role key from the same page — keep that one
          out of the browser and out of version control.
        </p>
        <p>
          Password sign-up and email confirmation are configured under <em>Authentication →
          Providers</em>. For a first deployment, email and password is enough; social providers can
          be added later without a code change.
        </p>
      </Step>

      <Step n="2" title="Apply the schema">
        <p>
          Five migration files live in <code>supabase/migrations</code>. Apply them in filename
          order. The script uses the Supabase Management API:
        </p>
        <pre className="code-block">
{`export SUPABASE_ACCESS_TOKEN=sbp_xxx
export SUPABASE_PROJECT_REF=your-project-ref
npm run db:push`}
        </pre>
        <p>
          Or paste each file into the SQL editor in the Supabase dashboard, in the same order. Both
          routes run identical SQL; the files are idempotent, so re-running them is safe.
        </p>
        <p>
          The schema creates seventeen tables, a read-only <code>weekly_progress</code> view, the
          search function, two storage buckets and the row-level security policies. RLS is enabled
          on every table, so the database — not the app — decides which rows a session may see.
        </p>
      </Step>

      <Step n="3" title="Load the curriculum">
        <p>
          Courses are JSON files in <code>content/courses</code>. The seed script derives the same
          ids the app derives, so a topic id in the database always matches the one in the app:
        </p>
        <pre className="code-block">
{`export SUPABASE_URL=https://your-project-ref.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
npm run seed            # or: npm run seed -- --dry-run to check first`}
        </pre>
      </Step>

      <Step n="4" title="Deploy to Vercel">
        <p>
          Import the repository at <strong>vercel.com</strong>. The framework is detected as
          Next.js; no build command override is needed. Add the environment variables below under
          <em> Settings → Environment Variables</em>, then deploy.
        </p>
        <div className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-inkfaint">
                <th className="py-2 pr-3 font-mono text-xs font-semibold">Variable</th>
                <th className="py-2 pr-3 text-xs font-semibold">Scope</th>
                <th className="py-2 text-xs font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {ENV_VARS.map((v) => (
                <tr key={v.name} className="border-b border-linesoft align-top">
                  <td className="py-2 pr-3 font-mono text-xs text-ink">
                    {v.name}
                    {v.secret ? (
                      <span className="badge badge-bad ml-1.5 align-middle">secret</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-inksoft">{v.where}</td>
                  <td className="py-2 text-inksoft">{v.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          After the first deployment, set the Vercel domain as the <em>Site URL</em> in Supabase
          under <em>Authentication → URL Configuration</em>, and add the preview domain to the
          redirect allowlist if you want password-reset emails to work on previews too.
        </p>
      </Step>

      <Step n="5" title="Check it worked">
        <ol>
          <li>The amber notice at the top of the app has disappeared.</li>
          <li>Sign-up sends a confirmation email and the account appears under <em>Authentication → Users</em>.</li>
          <li>
            Start a timer, close the tab, reopen it: the session resumes from its last heartbeat,
            because the row lives in Postgres.
          </li>
          <li>
            Sign in as a second account. Its dashboard, notes and search results contain nothing
            from the first — enforced by row-level security, not by the interface.
          </li>
          <li>
            <code>select count(*) from public.courses</code> in the SQL editor returns the number of
            courses you seeded.
          </li>
        </ol>
      </Step>

      <Card className="mt-8">
        <CardBody className="space-y-2 py-4">
          <p className="text-sm font-semibold text-ink">What the test suite already proves</p>
          <p className="text-sm leading-relaxed text-inksoft">
            Every migration is executed against a real Postgres in <code>npm test</code>, along with
            the row-level security policies and the full curriculum payload. See{' '}
            <code>tests/schema.pglite.test.ts</code>. What a local test cannot prove is your hosted
            project: the connection, the auth providers and the storage buckets have to be checked
            against the deployment itself.
          </p>
          <p className="text-sm leading-relaxed text-inksoft">
            Running locally for development instead:{' '}
            <Link href="/" className="text-accent-dark underline underline-offset-2">
              the README covers it
            </Link>
            .
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
