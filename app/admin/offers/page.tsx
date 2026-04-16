import { AdminShell } from '@/components/admin-shell';
import { adminOfferRows } from '@/lib/admin-data';

export default function AdminOffersPage() {
  const pendingCount = adminOfferRows.filter((item) => item.status === 'pending').length;
  const hiddenCount = adminOfferRows.filter((item) => item.status === 'hidden').length;
  const reportCount = adminOfferRows.reduce((sum, item) => sum + item.reportsCount, 0);

  return (
    <AdminShell
      title="Offer 池管理"
      description="这里先解决待审核、隐藏、软删除和举报处理，避免社区内容影响前台信任感。"
    >
      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['待审核内容', String(pendingCount), '优先决定是否通过前台展示'],
          ['已隐藏内容', String(hiddenCount), '保留软删除和恢复操作空间'],
          ['累计举报数', String(reportCount), '优先复核高风险帖子']
        ].map(([label, value, hint]) => (
          <div key={label} className="surface-card rounded-[26px] p-5">
            <div className="text-sm font-semibold text-slate-500">{label}</div>
            <div className="mt-3 text-3xl font-semibold text-ink">{value}</div>
            <div className="mt-3 text-sm leading-7 text-slate-500">{hint}</div>
          </div>
        ))}
      </section>

      <section className="surface-card overflow-hidden rounded-[30px]">
        <div className="grid grid-cols-[minmax(0,1.5fr)_120px_120px_120px_120px_160px] gap-3 bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <span>发帖用户 / 院校</span>
          <span>状态</span>
          <span>举报数</span>
          <span>点赞</span>
          <span>评论</span>
          <span>风险标签</span>
        </div>

        {adminOfferRows.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[minmax(0,1.5fr)_120px_120px_120px_120px_160px] gap-3 border-t border-black/5 px-5 py-4 text-sm"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{item.author} · {item.school}</div>
              <div className="mt-1 truncate text-slate-500">{item.major}</div>
              <div className="mt-2 text-xs text-slate-400">{item.anonymous ? '匿名发帖' : '实名发帖'} · {item.createdAt}</div>
            </div>
            <div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  item.status === 'pending'
                    ? 'bg-amber-50 text-amber-700'
                    : item.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700'
                      : item.status === 'hidden'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-rose-50 text-rose-700'
                }`}
              >
                {item.status}
              </span>
            </div>
            <div className="text-slate-600">{item.reportsCount}</div>
            <div className="text-slate-600">{item.likesCount}</div>
            <div className="text-slate-600">{item.commentsCount}</div>
            <div className="flex flex-wrap gap-2">
              {(item.riskFlags.length ? item.riskFlags : ['正常']).map((flag) => (
                <span key={flag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {flag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>
    </AdminShell>
  );
}
