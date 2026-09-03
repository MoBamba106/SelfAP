'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { signIn } from '@/lib/actions/auth';
import { Button, Card, CardBody, Field } from '@/components/ui/primitives';

function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/home';
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <Card className="anim-rise">
      <CardBody className="px-5 py-6 sm:px-6">
        <p className="eyebrow mb-1.5">Welcome back</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Sign in</h1>

        {state && !state.ok ? <p className="field-error mt-4">{state.message}</p> : null}

        <form action={action} className="mt-5 space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              autoComplete="email"
              required
              maxLength={254}
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              autoComplete="current-password"
              required
              minLength={8}
              maxLength={200}
            />
          </Field>

          <Button type="submit" variant="primary" className="btn-block" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href="/forgot-password" className="text-accent underline underline-offset-2">
            Forgot password?
          </Link>
          <Link href="/signup" className="text-accent underline underline-offset-2">
            Create an account
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="skeleton h-72 w-full" />}>
        <LoginForm />
      </Suspense>
      <p className="text-center text-xs leading-relaxed text-inkfaint">
        Prefer to look around first? The landing page has a demo account with a few months of
        study history already in it.
      </p>
    </div>
  );
}
