import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { adminNoticeRows } from '@/lib/admin-data';

export default function AdminNoticesPage() {
  return (
    <AdminShell
      title="通知库管理"
      description="这里集中处理通知的补录、修正、上下架、归档和人工复核。"
    >
      <section className="surface-card rounded-[30px] p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_220px_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <input
              placeholder="搜索标题、学校、学院或来源"
              className="w-full rounded-2xl border border-black/5 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none"
            />
          </label>
          <select className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none">
            <option>全部类型</option>
            <option>夏令营</option>
            <option>预推免</option>
            <option>正式推免</option>
          </select>
          <select className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none">
            <option>全部状态</option>
            <option>报名中</option>
            <option>即将截止</option>
            <option>已截止</option>
          </select>
          <Link
            href="/admin/notices/new"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            新建通知
          </Link>
        </div>
      </section>

      <section className="surface-card overflow-hidden rounded-[30px]">
        <div className="grid grid-cols-[minmax(0,1.6fr)_120px_140px_160px_120px_120px] gap-3 bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <span>标题 / 学校</span>
          <span>类型</span>
          <span>发布时间</span>
          <span>截止时间</span>
          <span>状态</span>
          <span>来源</span>
        </div>

        {adminNoticeRows.map((notice) => (
          <div
            key={notice.id}
            className="grid grid-cols-[minmax(0,1.6fr)_120px_140px_160px_120px_120px] gap-3 border-t border-black/5 px-5 py-4 text-sm"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{notice.school} · {notice.title}</div>
              <div className="mt-1 truncate text-slate-500">{notice.department}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                <span>{notice.operator}</span>
                <span>·</span>
                <span>{notice.manualEdited ? '人工修正' : '系统同步'}</span>
              </div>
            </div>
            <div className="text-slate-600">{notice.noticeType}</div>
            <div className="text-slate-600">{notice.publishDate}</div>
            <div className="text-slate-600">{notice.deadlineDate}</div>
            <div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  notice.status === '即将截止'
                    ? 'bg-amber-50 text-amber-700'
                    : notice.status === '已截止'
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {notice.status}
              </span>
            </div>
            <div className="text-slate-600">{notice.source}</div>
          </div>
        ))}
      </section>
    </AdminShell>
  );
}
