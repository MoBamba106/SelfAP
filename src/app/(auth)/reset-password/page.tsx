'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { updatePassword } from '@/lib/actions/auth';
import { Button, Card, CardBody, Field } from '@/components/ui/primitives';

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, null);

  return (
    <Card className="anim-rise">
      <CardBody className="px-5 py-6 sm:px-6">
        <p className="eyebrow mb-1.5">Almost there</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-inksoft">
          This page only works from the link in the reset email. If you landed here directly, ask
          for a new link.
        </p>

        {state?.message ? (
          <p className={`mt-4 text-sm ${state.ok ? 'text-good' : 'field-error'}`} role="status">
            {state.message}
          </p>
        ) : null}

        <form action={action} className="mt-5 space-y-4">
          <Field
            label="New password"
            htmlFor="password"
            hint="At least 8 characters."
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
            {pending ? 'Updating…' : 'Update password'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-inksoft">
          <Link href="/login" className="text-accent underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
