import { AdminShell } from '@/components/admin-shell';

export default function AdminNewNoticePage() {
  return (
    <AdminShell
      title="新建通知"
      description="当爬虫漏抓、原站结构混乱，或者你们需要临时补录重点院校时，可以先从这里手工录入。"
    >
      <section className="surface-card rounded-[30px] p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            '标题',
            '学校',
            '学院 / 项目',
            '通知类型',
            '原始链接',
            '发布时间',
            '截止时间',
            '地点 / 形式'
          ].map((label) => (
            <label key={label} className="grid gap-2">
              <span className="text-sm font-semibold text-ink">{label}</span>
              <input className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none" />
            </label>
          ))}
        </div>

        <div className="mt-4 grid gap-2">
          <span className="text-sm font-semibold text-ink">摘要</span>
          <textarea className="min-h-[120px] rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none" />
        </div>

        <div className="mt-4 grid gap-2">
          <span className="text-sm font-semibold text-ink">正文</span>
          <textarea className="min-h-[220px] rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none" />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white">保存为草稿</button>
          <button className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">发布通知</button>
        </div>
      </section>
    </AdminShell>
  );
}
