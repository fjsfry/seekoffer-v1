import type { LucideIcon } from 'lucide-react';
import type React from 'react';
import type { AdminMetric } from '@/lib/admin-data';

export function adminClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const metricToneMap: Record<AdminMetric['tone'], string> = {
  blue: 'bg-cyan-50 text-teal-700 ring-cyan-100',
  green: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
  purple: 'bg-violet-50 text-violet-600 ring-violet-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200'
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
  eyebrow,
  description,
  action,
  children,
  className = ''
}: {
  title?: string;
  eyebrow?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={adminClassNames('min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.045)]', className)}>
      {title || action || eyebrow || description ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          {title || eyebrow || description ? (
            <div>
              {eyebrow ? <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">{eyebrow}</div> : null}
              {title ? <h2 className="text-base font-semibold text-slate-950">{title}</h2> : null}
              {description ? <p className="mt-1 max-w-3xl line-clamp-2 text-sm leading-6 text-slate-500">{description}</p> : null}
            </div>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AdminMetricCard({ metric, icon: Icon }: { metric: AdminMetric; icon: LucideIcon }) {
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-100 hover:shadow-[0_16px_38px_rgba(13,148,136,0.08)]">
      <div className="flex items-start gap-3">
        <div className={adminClassNames('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition group-hover:scale-105', metricToneMap[metric.tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-500">{metric.label}</div>
          <div className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</div>
          <div className="mt-1 line-clamp-1 text-xs leading-5 text-slate-500" title={metric.hint}>{metric.hint}</div>
        </div>
      </div>
    </div>
  );
}

export function AdminStatusBadge({ status }: { status: string }) {
  return (
    <span className={adminClassNames('inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ring-1', statusToneMap[status] || 'bg-blue-50 text-blue-700 ring-blue-100')}>
      {status}
    </span>
  );
}

export function AdminInput({
  placeholder,
  className = '',
  value,
  onChange,
  type = 'text'
}: {
  placeholder: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      className={adminClassNames(
        'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-emerald-50',
        className
      )}
    />
  );
}

export function AdminSelect({
  label,
  options,
  value,
  onChange
}: {
  label?: string;
  options: Array<string | { label: string; value: string }>;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const normalizedOptions = options.map((option) => (typeof option === 'string' ? { label: option, value: option } : option));

  return (
    <label className="grid gap-2">
      {label ? <span className="text-sm font-medium text-slate-700">{label}</span> : null}
      <select
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-emerald-50"
      >
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminButton({
  children,
  tone = 'primary',
  onClick,
  disabled = false,
  type = 'button',
  className = ''
}: {
  children: React.ReactNode;
  tone?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-teal-700 text-white shadow-sm shadow-teal-700/20 hover:bg-teal-800'
      : tone === 'danger'
        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={adminClassNames(
        'inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        toneClass,
        className
      )}
    >
      {children}
    </button>
  );
}

export function AdminActionBanner({
  tone = 'info',
  children,
  action
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-100 bg-amber-50 text-amber-800'
        : tone === 'danger'
          ? 'border-rose-100 bg-rose-50 text-rose-700'
          : 'border-blue-100 bg-blue-50 text-blue-700';

  return (
    <div className={adminClassNames('flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between', toneClass)}>
      <div className="min-w-0 leading-6">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AdminFilterSummary({
  filters,
  onClear
}: {
  filters: Array<{ label: string; value: string | number | undefined | null; mutedValue?: string }>;
  onClear?: () => void;
}) {
  const activeFilters = filters.filter((item) => {
    const value = String(item.value ?? '').trim();
    return value && value !== item.mutedValue;
  });

  if (!activeFilters.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold text-slate-500">已筛选</span>
      {activeFilters.map((item) => (
        <span key={`${item.label}-${item.value}`} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 ring-1 ring-slate-200">
          {item.label}：{item.value}
        </span>
      ))}
      {onClear ? (
        <button type="button" onClick={onClear} className="rounded-full px-2 py-1 font-semibold text-blue-700 hover:bg-blue-50">
          清空
        </button>
      ) : null}
    </div>
  );
}

export function AdminSelectionBar({
  selectedCount,
  totalCount,
  children,
  onClear
}: {
  selectedCount: number;
  totalCount?: number;
  children: React.ReactNode;
  onClear?: () => void;
}) {
  const hasSelection = selectedCount > 0;

  return (
    <div
      className={adminClassNames(
        'flex flex-col gap-3 border-b border-slate-100 px-5 py-4 text-sm lg:flex-row lg:items-center lg:justify-between',
        hasSelection ? 'bg-blue-50/80' : 'bg-white'
      )}
    >
      <div className="font-medium text-slate-600">
        {hasSelection ? (
          <span className="text-blue-700">已选择 {selectedCount} 条{totalCount ? ` / 当前页 ${totalCount} 条` : ''}</span>
        ) : (
          <span>选择记录后可进行批量处理</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {hasSelection && onClear ? (
          <button type="button" onClick={onClear} className="h-10 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-white">
            取消选择
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
  icon: Icon
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="border-t border-slate-100 px-5 py-12 text-center">
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
        {Icon ? (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

export function AdminPagination({
  total,
  pages,
  page = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange
}: {
  total: string | number;
  pages?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const totalNumber = typeof total === 'number' ? total : Number.parseInt(total, 10) || 0;
  const computedPages = Math.max(1, Math.ceil(totalNumber / pageSize));
  const pageCount = pages || computedPages;
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const visiblePages = buildVisiblePages(safePage, pageCount);
  const canGoPrevious = safePage > 1;
  const canGoNext = safePage < pageCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-sm text-slate-500">
      <span>共 {totalNumber.toLocaleString('zh-CN')} 条 · 第 {safePage} / {pageCount} 页</span>
      <div className="flex items-center gap-2">
        <button
          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canGoPrevious}
          onClick={() => canGoPrevious && onPageChange?.(safePage - 1)}
        >
          上一页
        </button>
        {visiblePages.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-1 text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={`page-${item}`}
              className={adminClassNames(
                'h-8 min-w-8 rounded-lg px-3 font-medium',
                item === safePage ? 'bg-teal-700 text-white shadow-sm shadow-teal-700/20' : 'border border-slate-200 bg-white text-slate-600'
              )}
              onClick={() => onPageChange?.(item)}
            >
              {item}
            </button>
          )
        )}
        <button
          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canGoNext}
          onClick={() => canGoNext && onPageChange?.(safePage + 1)}
        >
          下一页
        </button>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
          className="ml-3 h-8 rounded-lg border border-slate-200 bg-white px-2 text-slate-600"
        >
          {[10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size} 条/页
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function buildVisiblePages(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const ordered = Array.from(pages)
    .filter((item) => item >= 1 && item <= total)
    .sort((left, right) => left - right);

  const result: Array<number | 'ellipsis'> = [];
  for (const item of ordered) {
    const previous = result[result.length - 1];
    if (typeof previous === 'number' && item - previous > 1) {
      result.push('ellipsis');
    }
    result.push(item);
  }

  return result;
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
    <div className="flex h-56 items-end gap-4 px-6 pb-5 pt-6">
      {data.map((item) => {
        const value = Number(item[valueKey]);
        return (
          <div key={`${item.date}-${valueKey}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="text-xs font-medium text-slate-500">{value.toLocaleString()}</div>
            <div className="flex h-32 w-full max-w-8 items-end rounded-md bg-slate-100">
              <div className={adminClassNames('w-full rounded-md', color)} style={{ height: `${Math.max((value / max) * 100, 8)}%` }} />
            </div>
            <div className="text-xs text-slate-400">{item.date}</div>
          </div>
        );
      })}
    </div>
  );
}
