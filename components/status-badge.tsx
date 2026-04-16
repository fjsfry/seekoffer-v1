import type { DeadlineLevel, PublicProjectStatus } from '@/lib/mock-data';

export function StatusBadge({ status }: { status: PublicProjectStatus }) {
  const tone =
    status === '即将截止'
      ? 'bg-orange-50 text-orange-700'
      : status === '报名中'
        ? 'bg-emerald-50 text-emerald-700'
        : status === '已截止'
          ? 'bg-slate-100 text-slate-500'
          : status === '活动中'
            ? 'bg-cyan-50 text-cyan-700'
            : 'bg-slate-100 text-slate-600';

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

export function DeadlineBadge({ level }: { level: DeadlineLevel }) {
  const mapping = {
    today: { label: '今日截止', tone: 'bg-rose-50 text-rose-700' },
    within3days: { label: '3 天内截止', tone: 'bg-orange-50 text-orange-700' },
    within7days: { label: '7 天内截止', tone: 'bg-amber-50 text-amber-700' },
    future: { label: '正常跟进', tone: 'bg-emerald-50 text-emerald-700' },
    expired: { label: '已截止', tone: 'bg-slate-100 text-slate-500' }
  } as const;

  const current = mapping[level];
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${current.tone}`}>{current.label}</span>;
}
