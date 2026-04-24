import { FeedbackEntry } from './feedback-entry';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip">
      <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col px-4 pb-5 sm:px-6 lg:px-8">
        <SiteHeader />
        <main className="animate-rise flex-1 space-y-8 pt-5 lg:pt-9">{children}</main>
        <FeedbackEntry />
        <SiteFooter />
      </div>
    </div>
  );
}
