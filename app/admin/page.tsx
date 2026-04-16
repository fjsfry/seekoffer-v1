import Link from 'next/link';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';

export default function AdminIndexPage() {
  return (
    <AdminShell
      title="后台入口"
      description="这里是 Seekoffer 轻运营后台的总入口，先解决运营同学每天最需要处理的四件事。"
    >
      <section className="surface-card rounded-[30px] p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand/10 text-brand">
            <LayoutDashboard className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-ink">先进入仪表盘看全局</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              仪表盘会先告诉你今天新增了多少通知、是否有待审核的 Offer、哪路爬虫挂了，以及哪些节点需要立即人工处理。
            </p>
            <Link
              href="/admin/dashboard"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
            >
              打开仪表盘
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
