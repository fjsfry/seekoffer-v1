import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip">
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col px-4 py-4 lg:px-10 lg:py-5">
        <SiteHeader />
        <main className="animate-rise flex-1 space-y-6">{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
