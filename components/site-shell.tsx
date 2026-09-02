import { FeedbackEntry } from './feedback-entry';
import { SiteAnnouncement } from './site-announcement';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg transition focus:translate-y-0"
      >
        跳到主要内容
      </a>
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 pb-5 sm:px-6 lg:px-10">
        <SiteHeader />
        <SiteAnnouncement />
        <main id="main-content" tabIndex={-1} className="animate-rise flex-1 space-y-8 pt-5 outline-none lg:space-y-10 lg:pt-10">{children}</main>
        <FeedbackEntry />
        <SiteFooter />
      </div>
    </div>
  );
}
