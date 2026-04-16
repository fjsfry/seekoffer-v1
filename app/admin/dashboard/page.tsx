import Link from 'next/link';
import { ArrowRight, BookOpenCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import {
  adminCrawlerJobs,
  adminNoticeRows,
  adminQuickActions,
  buildAdminDashboardCards,
  buildAdminRiskItems
} from '@/lib/admin-data';

const toneMap = {
  brand: 'bg-brand/8 text-brand',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  slate: 'bg-slate-100 text-slate-700'
} as const;

const riskToneMap = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700'
} as const;

export default function AdminDashboardPage() {
  const cards = buildAdminDashboardCards();
  const risks = buildAdminRiskItems();

  return (
    <AdminShell
      title="仪表盘"
      description="先知道今天有没有新数据、哪些内容要人工处理，以及爬虫是不是挂了。"
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="surface-card rounded-[26px] p-5">
            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneMap[card.tone]}`}>{card.label}</div>
            <div className="mt-4 text-3xl font-semibold text-ink">{card.value}</div>
            <p className="mt-3 text-sm leading-7 text-slate-500">{card.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_380px]">
        <div className="surface-card rounded-[30px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <ShieldAlert className="h-4 w-4" />
                风险提醒
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-500">把即将截止、抓取异常和待审核内容先抬上来。</p>
            </div>
            <Link href="/admin/crawlers" className="text-sm font-semibold text-brand">
              去看日志
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {risks.map((item) => (
              <div key={item.id} className={`rounded-[24px] border px-4 py-4 ${riskToneMap[item.level]}`}>
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="mt-1 text-sm leading-7">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card rounded-[30px] p-6">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
            <RefreshCw className="h-4 w-4" />
            快捷操作
          </div>
          <div className="mt-5 grid gap-3">
            {adminQuickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="rounded-[24px] bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-ink">{action.title}</div>
                  <ArrowRight className="h-4 w-4 text-brand" />
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-500">{action.description}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="surface-card rounded-[30px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                <BookOpenCheck className="h-4 w-4" />
                最近同步的通知
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-500">先看最近新增或改动过的重点项目。</p>
            </div>
            <Link href="/admin/notices" className="text-sm font-semibold text-brand">
              去通知库管理
            </Link>
          </div>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-black/5">
            <div className="grid grid-cols-[minmax(0,1.5fr)_180px_150px] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <span>标题</span>
              <span>截止时间</span>
              <span>来源</span>
            </div>
            {adminNoticeRows.slice(0, 8).map((notice) => (
              <div
                key={notice.id}
                className="grid grid-cols-[minmax(0,1.5fr)_180px_150px] gap-3 border-t border-black/5 px-4 py-4 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">{notice.school} · {notice.title}</div>
                  <div className="mt-1 truncate text-slate-500">{notice.department}</div>
                </div>
                <div className="text-slate-600">{notice.deadlineDate}</div>
                <div className="text-slate-600">{notice.source}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card rounded-[30px] p-6">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
            <RefreshCw className="h-4 w-4" />
            最近爬虫任务
          </div>
          <div className="mt-5 grid gap-3">
            {adminCrawlerJobs.map((job) => (
              <div key={job.id} className="rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-ink">{job.sourceName}</div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      job.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : job.status === 'partial_failed'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {job.status === 'success' ? '成功' : job.status === 'partial_failed' ? '部分失败' : '失败'}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-500">{job.startedAt}</div>
                <div className="mt-3 text-sm leading-7 text-slate-600">{job.errorSummary}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
