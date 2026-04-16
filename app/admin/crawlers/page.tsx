import { AdminShell } from '@/components/admin-shell';
import { adminCrawlerJobs } from '@/lib/admin-data';

export default function AdminCrawlersPage() {
  const successCount = adminCrawlerJobs.filter((item) => item.status === 'success').length;
  const failedCount = adminCrawlerJobs.filter((item) => item.status === 'failed').length;
  const partialCount = adminCrawlerJobs.filter((item) => item.status === 'partial_failed').length;

  return (
    <AdminShell
      title="爬虫与同步"
      description="看抓取任务的运行结果、失败原因和同步增量，决定要不要人工补跑。"
    >
      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['成功任务', String(successCount), '最近运行结果正常的同步任务'],
          ['失败任务', String(failedCount), '需要人工排查或重跑的任务'],
          ['部分失败', String(partialCount), '抓到数据但仍有明细需要复核']
        ].map(([label, value, hint]) => (
          <div key={label} className="surface-card rounded-[26px] p-5">
            <div className="text-sm font-semibold text-slate-500">{label}</div>
            <div className="mt-3 text-3xl font-semibold text-ink">{value}</div>
            <div className="mt-3 text-sm leading-7 text-slate-500">{hint}</div>
          </div>
        ))}
      </section>

      <section className="surface-card overflow-hidden rounded-[30px]">
        <div className="grid grid-cols-[180px_140px_120px_160px_100px_100px_100px_minmax(0,1fr)] gap-3 bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <span>任务名</span>
          <span>数据源</span>
          <span>状态</span>
          <span>开始时间</span>
          <span>新增</span>
          <span>更新</span>
          <span>失败</span>
          <span>错误摘要</span>
        </div>

        {adminCrawlerJobs.map((job) => (
          <div
            key={job.id}
            className="grid grid-cols-[180px_140px_120px_160px_100px_100px_100px_minmax(0,1fr)] gap-3 border-t border-black/5 px-5 py-4 text-sm"
          >
            <div className="font-semibold text-ink">{job.taskName}</div>
            <div className="text-slate-600">{job.sourceName}</div>
            <div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  job.status === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : job.status === 'partial_failed'
                      ? 'bg-amber-50 text-amber-700'
                      : job.status === 'running'
                        ? 'bg-sky-50 text-sky-700'
                        : 'bg-rose-50 text-rose-700'
                }`}
              >
                {job.status}
              </span>
            </div>
            <div className="text-slate-600">{job.startedAt}</div>
            <div className="text-slate-600">{job.newCount}</div>
            <div className="text-slate-600">{job.updatedCount}</div>
            <div className="text-slate-600">{job.failedCount}</div>
            <div className="text-slate-600">{job.errorSummary}</div>
          </div>
        ))}
      </section>
    </AdminShell>
  );
}
