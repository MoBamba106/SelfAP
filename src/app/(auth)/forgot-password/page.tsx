'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/actions/auth';
import { Button, Card, CardBody, Field } from '@/components/ui/primitives';

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <Card className="anim-rise">
      <CardBody className="px-5 py-6 sm:px-6">
        <p className="eyebrow mb-1.5">Account recovery</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Reset your password
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-inksoft">
          Enter the address you signed up with. If an account exists for it, a reset link is on
          its way — we do not confirm which addresses are registered.
        </p>

        {state?.message ? (
          <p className={`mt-4 text-sm ${state.ok ? 'text-good' : 'field-error'}`} role="status">
            {state.message}
          </p>
        ) : null}

        <form action={action} className="mt-5 space-y-4">
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
          <Button type="submit" variant="primary" className="btn-block" disabled={pending}>
            {pending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-inksoft">
          Remembered it?{' '}
          <Link href="/login" className="text-accent underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
