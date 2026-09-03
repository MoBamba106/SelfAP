import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeScript } from '@/components/layout/theme-script';

export const metadata: Metadata = {
  title: {
    default: 'SelfAP — your independent AP study workspace',
    template: '%s · SelfAP',
  },
  description:
    'SelfAP helps self-studying AP students decide what to study next, learn it in the app, practise it, and see whether they are actually improving.',
  applicationName: 'SelfAP',
  keywords: [
    'AP self study',
    'AP Statistics',
    'AP US Government',
    'AP English Language',
    'AP English Literature',
    'study planner',
    'exam preparation',
  ],
  openGraph: {
    title: 'SelfAP — your independent AP study workspace',
    description:
      'Curriculum, lessons, practice and honest progress tracking for students studying AP courses on their own.',
    siteName: 'SelfAP',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ece2d1' },
    { media: '(prefers-color-scheme: dark)', color: '#211e1b' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="paper" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
