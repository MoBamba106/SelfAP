import Link from 'next/link';
import { BrandMark } from './header';

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Study',
    links: [
      { href: '/courses', label: 'Courses' },
      { href: '/study', label: 'Study timer' },
      { href: '/practice', label: 'Practice' },
      { href: '/progress', label: 'Progress' },
      { href: '/planner', label: 'Planner' },
      { href: '/notes', label: 'Notes' },
      { href: '/exam', label: 'Exam prep' },
    ],
  },
  {
    heading: 'SelfAP',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/settings', label: 'Settings' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms & Conditions' },
      { href: '/dmca', label: 'DMCA Policy' },
    ],
  },
];

export function AppFooter() {
  return (
    <footer className="no-print mt-16 border-t border-line bg-paper-raised/50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark size={26} />
              <span className="font-display text-lg font-semibold text-ink">
                Self<span className="text-accent">AP</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-inksoft">
              Your independent AP study workspace.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <p className="eyebrow mb-3">{col.heading}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-inksoft underline-offset-4 transition-colors hover:text-accent hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 border-t border-linesoft pt-6">
          <p className="text-xs leading-relaxed text-inkfaint">
            SelfAP is an independent study tool and is not affiliated with, endorsed by, or
            sponsored by College Board. AP&reg; and Advanced Placement&reg; are registered
            trademarks of College Board, which is not connected to SelfAP and does not
            review or endorse this product. All lesson text, practice questions and study
            material on this site are original to SelfAP; official College Board resources
            are linked out and clearly labelled as external.
          </p>
          <p className="mt-4 text-xs text-inkghost">
            &copy; {new Date().getFullYear()} SelfAP
          </p>
        </div>
      </div>
    </footer>
  );
}
