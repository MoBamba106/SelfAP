import { AppHeader, MobileTabBar } from '@/components/layout/header';
import { AppFooter } from '@/components/layout/footer';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <MobileTabBar />
      <main id="main" className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
      <AppFooter />
    </div>
  );
}
