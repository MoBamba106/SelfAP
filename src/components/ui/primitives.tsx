import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/format';

/* ------------------------------------------------------------------ *
 * Button. One component, five variants, three sizes. Renders an <a>
 * when given an href and a <button> otherwise, so links are always
 * links and keyboard/screen-reader behaviour is never faked.
 * ------------------------------------------------------------------ */

type Variant = 'primary' | 'default' | 'quiet' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  default: '',
  quiet: 'btn-quiet',
  danger: 'btn-danger',
};

const SIZE: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  href?: string;
  external?: boolean;
}

export function Button({
  variant = 'default',
  size = 'md',
  block,
  className,
  href,
  external,
  children,
  type,
  ...rest
}: ButtonProps) {
  const classes = cn('btn', VARIANT[variant], SIZE[size], block && 'btn-block', className);

  if (href) {
    if (external) {
      return (
        <a
          className={classes}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          {children}
        </a>
      );
    }
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} type={type ?? 'button'} {...rest}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  spine,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  /** Subject tint applied to the left edge. */
  spine?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Tag
      className={cn('card card-spine', className)}
      style={spine ? { '--spine': `var(--t-${spine})` } as React.CSSProperties : undefined}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  action,
  eyebrow,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-linesoft px-4 py-3 sm:px-5', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h2 className="font-display text-lg font-semibold leading-tight text-ink">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-4 py-4 sm:px-5', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ *
 * Badge
 * ------------------------------------------------------------------ */

export type BadgeTone = 'muted' | 'accent' | 'good' | 'warn' | 'bad' | 'info' | 'ochre';

export function Badge({
  children,
  tone = 'muted',
  className,
  dot,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  /** Adds a glyph so status never relies on colour alone. */
  dot?: boolean;
}) {
  const toneClass = {
    muted: '',
    accent: 'badge-accent',
    good: 'badge-good',
    warn: 'badge-warn',
    bad: 'badge-bad',
    info: 'badge-info',
    ochre: 'badge-ochre',
  }[tone];

  return (
    <span className={cn('badge', toneClass, className)}>
      {dot ? <span className="chip-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Meter
 * ------------------------------------------------------------------ */

export function Meter({
  value,
  max,
  state,
  tall,
  label,
  className,
}: {
  value: number;
  max: number;
  state?: 'in-progress' | 'reached' | 'exceeded';
  tall?: boolean;
  label?: string;
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fillState = state === 'exceeded' ? 'exceeded' : state === 'reached' ? 'reached' : 'in-progress';
  return (
    <div
      className={cn('meter', tall && 'meter-tall', className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
    >
      <span className="meter-fill" data-state={fillState} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function MasteryMeter({ rung, label }: { rung: number; label: string }) {
  return (
    <div className="mastery-track" data-rung={rung} role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} data-on={n <= rung ? 'true' : 'false'} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Empty / loading / error states
 * ------------------------------------------------------------------ */

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-2 rounded-[var(--radius-card)] border border-dashed border-line bg-paper-raised/60 px-5 py-6',
        className,
      )}
    >
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description ? (
        <p className="max-w-prose text-sm leading-relaxed text-inksoft">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--bad)_35%,var(--line))] bg-[color-mix(in_srgb,var(--bad)_8%,var(--paper-raised))] px-5 py-4"
    >
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-inksoft">{message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Section heading used across pages
 * ------------------------------------------------------------------ */

export function SectionHeading({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div>
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Stat
 * ------------------------------------------------------------------ */

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="eyebrow truncate">{label}</p>
      <p className="font-display text-2xl font-semibold tabular-nums text-ink sm:text-[28px]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-inkfaint">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Form field wrapper
 * ------------------------------------------------------------------ */

export const Field = forwardRef<HTMLDivElement, { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }>(
  function Field({ label, hint, error, children, htmlFor }, ref) {
    return (
      <div ref={ref}>
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
        {children}
        {hint && !error ? <p className="hint">{hint}</p> : null}
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
