'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { backendKind } from '@/lib/supabase/env';
import { DEMO_COOKIE } from '@/lib/auth/session';
import { rateLimit } from '@/lib/utils/rate-limit';

export interface ActionState {
  ok: boolean;
  message: string;
  field?: string;
}

const credentials = z.object({
  email: z.string().trim().email('Enter a valid email address').max(254),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
});

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
}

/** Human-readable message for the Supabase/GoTrue error codes we care about. */
function authMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login')) return 'That email and password do not match.';
  if (lower.includes('already registered') || lower.includes('already been registered'))
    return 'An account with that email already exists. Try signing in.';
  if (lower.includes('email not confirmed'))
    return 'Check your inbox to confirm your email address, then sign in.';
  if (lower.includes('rate limit') || lower.includes('too many'))
    return 'Too many attempts. Wait a minute and try again.';
  if (lower.includes('password')) return 'Choose a stronger password — at least 8 characters.';
  return 'Something went wrong. Please try again.';
}

export async function signIn(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const ip = await clientIp();
  const limited = rateLimit(`signin:${ip}`, 10, 60_000);
  if (!limited.ok) {
    return { ok: false, message: `Too many attempts. Try again in ${limited.retryAfter}s.` };
  }

  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue.message, field: String(issue.path[0] ?? 'email') };
  }

  if (backendKind() === 'demo') {
    const store = await cookies();
    store.set(DEMO_COOKIE, '1', { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' });
    redirect('/home');
  }

  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: authMessage(error.message), field: 'password' };

  revalidatePath('/', 'layout');
  redirect(String(formData.get('next') ?? '/home'));
}

export async function signUp(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const ip = await clientIp();
  const limited = rateLimit(`signup:${ip}`, 5, 60 * 60_000);
  if (!limited.ok) {
    return { ok: false, message: 'Too many sign-up attempts. Try again later.' };
  }

  const parsed = z
    .object({
      name: z.string().trim().min(1, 'Tell us what to call you').max(60),
      email: z.string().trim().email('Enter a valid email address').max(254),
      password: z.string().min(8, 'Use at least 8 characters').max(200),
    })
    .safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
    });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue.message, field: String(issue.path[0] ?? 'email') };
  }

  if (backendKind() === 'demo') {
    const store = await cookies();
    store.set(DEMO_COOKIE, '1', { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' });
    redirect('/home');
  }

  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.name } },
  });
  if (error) return { ok: false, message: authMessage(error.message), field: 'email' };

  // If email confirmation is off, Supabase signs the user straight in.
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    revalidatePath('/', 'layout');
    redirect('/home');
  }
  return { ok: true, message: 'Check your inbox to confirm your email address, then sign in.' };
}

export async function signOut(): Promise<void> {
  if (backendKind() === 'demo') {
    const store = await cookies();
    store.delete(DEMO_COOKIE);
    redirect('/');
  }
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function requestPasswordReset(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const ip = await clientIp();
  const limited = rateLimit(`reset:${ip}`, 3, 10 * 60_000);
  if (!limited.ok) return { ok: false, message: 'Too many requests. Try again later.' };

  const email = z.string().trim().email().safeParse(formData.get('email'));
  if (!email.success) return { ok: false, message: 'Enter a valid email address.', field: 'email' };

  if (backendKind() === 'demo') {
    return { ok: true, message: 'Demo mode does not send email. Use "Try the demo" to explore.' };
  }

  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/reset-password`,
  });

  // Always report success: revealing which emails are registered would be an
  // account-enumeration leak.
  if (error) return { ok: true, message: 'If that address has an account, a reset link is on its way.' };
  return { ok: true, message: 'If that address has an account, a reset link is on its way.' };
}

export async function updatePassword(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(200)
    .safeParse(formData.get('password'));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, field: 'password' };

  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, message: authMessage(error.message), field: 'password' };
  redirect('/settings');
}
