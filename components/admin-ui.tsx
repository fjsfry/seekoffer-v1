import type { LucideIcon } from 'lucide-react';
import type React from 'react';
import type { AdminMetric } from '@/lib/admin-data';

export function adminClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const metricToneMap: Record<AdminMetric['tone'], string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  purple: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-600'
};

const statusToneMap: Record<string, string> = {
  待审核: 'bg-amber-50 text-amber-700 ring-amber-100',
  已发布: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  已通过: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  已解决: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  正常: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  成功: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  处理中: 'bg-blue-50 text-blue-700 ring-blue-100',
  限制: 'bg-amber-50 text-amber-700 ring-amber-100',
  已隐藏: 'bg-slate-100 text-slate-700 ring-slate-200',
  已下架: 'bg-slate-100 text-slate-700 ring-slate-200',
  已关闭: 'bg-slate-100 text-slate-700 ring-slate-200',
  已驳回: 'bg-rose-50 text-rose-700 ring-rose-100',
  已删除: 'bg-rose-50 text-rose-700 ring-rose-100',
  封禁: 'bg-rose-50 text-rose-700 ring-rose-100',
  失败: 'bg-rose-50 text-rose-700 ring-rose-100'
};

export function AdminPanel({
  title,
  action,
  children,
  className = ''
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={adminClassNames('rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          {title ? <h2 className="text-base font-semibold text-slate-950">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AdminMetricCard({ metric, icon: Icon }: { metric: AdminMetric; icon: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={adminClassNames('flex h-14 w-14 items-center justify-center rounded-full', metricToneMap[metric.tone])}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <div className="text-sm text-slate-500">{metric.label}</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{metric.value}</div>
          <div className="mt-1 text-xs text-slate-500">{metric.hint}</div>
        </div>
      </div>
    </div>
  );
}

export function AdminStatusBadge({ status }: { status: string }) {
  return (
    <span className={adminClassNames('inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ring-1', statusToneMap[status] || 'bg-blue-50 text-blue-700 ring-blue-100')}>
      {status}
    </span>
  );
}

export function AdminInput({ placeholder, className = '' }: { placeholder: string; className?: string }) {
  return (
    <input
      placeholder={placeholder}
      className={adminClassNames(
        'h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50',
        className
      )}
    />
  );
}

export function AdminSelect({ label, options }: { label?: string; options: string[] }) {
  return (
    <label className="grid gap-2">
      {label ? <span className="text-sm font-medium text-slate-700">{label}</span> : null}
      <select className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export function AdminButton({
  children,
  tone = 'primary'
}: {
  children: React.ReactNode;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : tone === 'danger'
        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50';

  return <button className={adminClassNames('inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition', toneClass)}>{children}</button>;
}

export function AdminPagination({ total, pages = 5 }: { total: string; pages?: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-sm text-slate-500">
      <span>共 {total} 条</span>
      <div className="flex items-center gap-2">
        <button className="h-8 rounded-lg border border-slate-200 px-3 text-slate-500">‹</button>
        {Array.from({ length: pages }, (_, index) => (
          <button
            key={`page-${index + 1}`}
            className={adminClassNames(
              'h-8 min-w-8 rounded-lg px-3 font-medium',
              index === 0 ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600'
            )}
          >
            {index + 1}
          </button>
        ))}
        <button className="h-8 rounded-lg border border-slate-200 px-3 text-slate-500">›</button>
        <select className="ml-3 h-8 rounded-lg border border-slate-200 px-2 text-slate-600">
          <option>10 条/页</option>
          <option>20 条/页</option>
        </select>
      </div>
    </div>
  );
}

export function AdminMiniBars({
  data,
  valueKey,
  color = 'bg-blue-500'
}: {
  data: Array<Record<string, string | number>>;
  valueKey: string;
  color?: string;
}) {
  const values = data.map((item) => Number(item[valueKey]));
  const max = Math.max(...values, 1);

  return (
    <div className="flex h-64 items-end gap-4 px-6 pb-6 pt-8">
      {data.map((item) => {
        const value = Number(item[valueKey]);
        return (
          <div key={`${item.date}-${valueKey}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="text-xs font-medium text-slate-500">{value.toLocaleString()}</div>
            <div className="flex h-40 w-full max-w-8 items-end rounded-full bg-slate-100">
              <div className={adminClassNames('w-full rounded-full', color)} style={{ height: `${Math.max((value / max) * 100, 8)}%` }} />
            </div>
            <div className="text-xs text-slate-400">{item.date}</div>
          </div>
        );
      })}
    </div>
  );
}
