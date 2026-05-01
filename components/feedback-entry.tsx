import { MessageCircle } from 'lucide-react';
import { QQ_GROUP_URL } from '@/lib/contact';

export function FeedbackEntry() {
  return (
    <a
      href={QQ_GROUP_URL}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 right-5 z-50 hidden items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(23,73,77,0.24)] transition hover:-translate-y-0.5 md:inline-flex"
    >
      <MessageCircle className="h-4 w-4" />
      加入 QQ 群
    </a>
  );
}
