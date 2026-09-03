import { AppHeader } from '@/components/layout/header';
import { AppFooter } from '@/components/layout/footer';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
