import { MessageCircleWarning } from 'lucide-react';

export function FeedbackEntry() {
  return (
    <a
      href="mailto:feedback@seekoffer.com.cn?subject=Seekoffer%20%E4%BA%A7%E5%93%81%E5%8F%8D%E9%A6%88"
      className="fixed bottom-5 right-5 z-50 hidden items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(23,73,77,0.24)] transition hover:-translate-y-0.5 md:inline-flex"
    >
      <MessageCircleWarning className="h-4 w-4" />
      反馈与纠错
    </a>
  );
}
