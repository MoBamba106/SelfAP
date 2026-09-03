import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class joiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/** CSS custom property carrying the course tint, for the spine + accents. */
export function courseTint(accent: string): Record<string, string> {
  return {
    '--spine': `var(--t-${accent})`,
    '--tint': `var(--t-${accent})`,
    '--tint-soft': `var(--t-${accent}-soft)`,
  };
}
