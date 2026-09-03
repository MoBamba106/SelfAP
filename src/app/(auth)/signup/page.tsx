'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signUp } from '@/lib/actions/auth';
import { Button, Card, CardBody, Field } from '@/components/ui/primitives';

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, null);

  return (
    <Card className="anim-rise">
      <CardBody className="px-5 py-6 sm:px-6">
        <p className="eyebrow mb-1.5">Free account</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Start studying
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-inksoft">
          No card, no trial countdown. Your sessions, notes and progress stay yours and you can
          export or delete all of it at any time.
        </p>

        {state && !state.ok ? <p className="field-error mt-4">{state.message}</p> : null}

        <form action={action} className="mt-5 space-y-4">
          <Field label="What should we call you?" htmlFor="name">
            <input
              id="name"
              name="name"
              className="input"
              autoComplete="name"
              required
              maxLength={60}
            />
          </Field>
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
          <Field
            label="Password"
            htmlFor="password"
            hint="At least 8 characters. Use a password manager if you have one."
          >
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={200}
            />
          </Field>

          <Button type="submit" variant="primary" className="btn-block" disabled={pending}>
            {pending ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-inksoft">
          Already have an account?{' '}
          <Link href="/login" className="text-accent underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
