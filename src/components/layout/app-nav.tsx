'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Compass, Gauge, Home, Timer } from 'lucide-react';
import { cn } from '@/lib/utils/format';

export const NAV_ITEMS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/courses', label: 'Courses', icon: BookOpen },
  { href: '/study', label: 'Study', icon: Timer },
  { href: '/practice', label: 'Practice', icon: Compass },
  { href: '/progress', label: 'Progress', icon: Gauge },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop navigation. Server-rendered links; only active state is client-side. */
export function DesktopNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={cn('hidden items-center gap-1 md:flex', className)}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative rounded-[var(--radius-ctl)] px-3 py-2 text-sm font-semibold transition-colors duration-150',
              active ? 'text-ink' : 'text-inkfaint hover:text-ink',
            )}
          >
            {item.label}
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-accent transition-opacity duration-200',
                active ? 'opacity-100' : 'opacity-0',
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Mobile bottom tab bar. Deliberately a real tab bar rather than a
 * hamburger menu: the five destinations are the whole app, and a thumb
 * reaches the bottom of a phone without a second tap.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'no-tap-flash flex flex-col items-center gap-0.5 px-1 py-2 text-[10.5px] font-semibold transition-colors',
                  active ? 'text-accent' : 'text-inkfaint',
                )}
              >
                <Icon size={19} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
