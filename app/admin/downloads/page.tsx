'use client';

import {BarChart3, Download, MonitorDown, RefreshCw, Search} from 'lucide-react';
import {FormEvent, useCallback, useEffect, useState} from 'react';
import {AdminActionBanner, AdminEmptyState, AdminInput, AdminMetricCard, AdminPagination, AdminPanel, adminClassNames} from '@/components/admin-ui';
import {AdminShell} from '@/components/admin-shell';
import {getAdminErrorMessage, invokeAdminApi} from '@/lib/admin-api';

type DownloadMonitor = {
  checkedAt: string;
  tracking: {enabled: boolean; releaseVersion: string | null; platform: string; source: string};
  metrics: {total: number; today: number; lastSevenDays: number; lastThirtyDays: number; latestAt: string | null; firstAt: string | null};
  trend: Array<{date: string; count: number}>;
  versions: Array<{version: string; count: number; latestAt: string}>;
  records: {items: Array<{id: number; attemptId: string; releaseVersion: string; platform: string; source: string; createdAt: string}>; total: number; page: number; pageSize: number; pages: number; window: {from: string | null; to: string}; query: string};
};

function formatTime(value: string | null) {
  if (!value) return '暂无记录';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '时间异常';
  return new Intl.DateTimeFormat('zh-CN', {timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'}).format(date);
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '--' : value.toLocaleString('zh-CN');
}

export default function AdminDownloadsPage() {
  const [data, setData] = useState<DownloadMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invokeAdminApi<DownloadMonitor>({resource: 'download_monitor', action: 'snapshot', page, pageSize, filters: {query: appliedQuery, windowDays: 0}});
      setData(result);
      setMessage('');
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '下载统计暂时无法更新。'));
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, page, pageSize]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedQuery(query.trim());
  }

  const maxTrend = Math.max(...(data?.trend || []).map((item) => item.count), 1);
  const maxVersion = Math.max(...(data?.versions || []).map((item) => item.count), 1);

  return (
    <AdminShell title="桌面下载" description="查看桌面端下载量、版本分布和每一次下载记录。">
      <div className="space-y-5">
        {message ? <AdminActionBanner tone="danger" action={<button type="button" onClick={() => void load()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-current/20 px-3 text-sm font-semibold"><RefreshCw className={adminClassNames('h-4 w-4', loading && 'animate-spin')} />重试</button>}>{message}</AdminActionBanner> : null}
        <AdminActionBanner tone={data?.tracking.enabled ? 'success' : 'warning'} action={<button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-current/20 px-3 text-sm font-semibold disabled:opacity-50"><RefreshCw className={adminClassNames('h-4 w-4', loading && 'animate-spin')} />{loading ? '更新中' : '刷新'}</button>}>
          {loading && !data ? '正在读取下载记录…' : data?.tracking.enabled ? `下载记录正常采集，当前版本 ${data.tracking.releaseVersion || '未配置'}。` : '下载记录采集未开启，请检查桌面端下载配置。'}
          {data ? <span className="ml-2 text-xs opacity-70">更新于 {formatTime(data.checkedAt)}</span> : null}
        </AdminActionBanner>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard metric={{label: '累计下载', value: formatNumber(data?.metrics.total), hint: data?.metrics.firstAt ? `始于 ${formatTime(data.metrics.firstAt)}` : '等待首条记录', tone: 'blue'}} icon={Download} />
          <AdminMetricCard metric={{label: '今日下载', value: formatNumber(data?.metrics.today), hint: '北京时间自然日', tone: 'green'}} icon={BarChart3} />
          <AdminMetricCard metric={{label: '近 7 日下载', value: formatNumber(data?.metrics.lastSevenDays), hint: '含今日', tone: 'purple'}} icon={MonitorDown} />
          <AdminMetricCard metric={{label: '近 30 日下载', value: formatNumber(data?.metrics.lastThirtyDays), hint: `最近一次 ${formatTime(data?.metrics.latestAt || null)}`, tone: 'amber'}} icon={RefreshCw} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <AdminPanel title="近 14 日下载趋势" action={<span className="text-xs text-slate-500">按北京时间统计</span>}>
            <div className="grid h-64 grid-cols-7 gap-3 px-5 pb-5 pt-7 sm:grid-cols-[repeat(14,minmax(0,1fr))]">
              {(data?.trend || []).map((item) => <div key={item.date} className="flex min-w-0 flex-col items-center justify-end gap-2"><span className="text-[11px] font-medium text-slate-500">{item.count || ''}</span><div className="flex h-36 w-full max-w-8 items-end rounded-md bg-slate-100"><div className="w-full rounded-md bg-teal-600 transition-all" style={{height: `${Math.max((item.count / maxTrend) * 100, item.count ? 8 : 0)}%`}} /></div><span className="text-[11px] text-slate-400">{item.date}</span></div>)}
            </div>
            {!data?.trend.length ? <div className="px-5 pb-8 text-center text-sm text-slate-500">暂无趋势记录。</div> : null}
          </AdminPanel>

          <AdminPanel title="版本分布" action={<span className="text-xs text-slate-500">近 30 日</span>}>
            <div className="space-y-4 px-5 py-5">{(data?.versions || []).map((item) => <div key={item.version}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-800">v{item.version}</span><span className="font-semibold tabular-nums text-slate-700">{formatNumber(item.count)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{width: `${Math.max((item.count / maxVersion) * 100, 6)}%`}} /></div></div>)}{!data?.versions.length ? <div className="py-8 text-center text-sm text-slate-500">暂无版本记录。</div> : null}</div>
          </AdminPanel>
        </div>

        <AdminPanel title="下载记录" action={<span className="text-xs text-slate-500">共 {formatNumber(data?.records.total)} 条</span>}>
          <form onSubmit={submitFilters} className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-end"><label className="grid flex-1 gap-2"><span className="text-xs font-semibold text-slate-500">搜索记录</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><AdminInput placeholder="尝试 ID、版本或来源" value={query} onChange={setQuery} className="pl-9" /></div></label><button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800"><Search className="h-4 w-4" />查询</button></form>
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">记录 ID</th><th className="px-4 py-3">版本</th><th className="px-4 py-3">平台</th><th className="px-4 py-3">来源</th><th className="px-4 py-3">记录时间</th></tr></thead><tbody>{(data?.records.items || []).map((item, index) => <tr key={item.attemptId} className={adminClassNames('border-t border-slate-100 hover:bg-emerald-50/30', index % 2 === 1 && 'bg-slate-50/30')}><td className="px-5 py-4 font-mono text-xs text-slate-700">{item.attemptId}</td><td className="px-4 py-4 font-semibold text-slate-800">v{item.releaseVersion}</td><td className="px-4 py-4 text-slate-600">{item.platform}</td><td className="px-4 py-4 text-slate-600">{item.source}</td><td className="px-4 py-4 text-slate-600">{formatTime(item.createdAt)}</td></tr>)}</tbody></table></div>
          {!loading && !(data?.records.items.length) ? <AdminEmptyState title="暂无下载记录" description="当前筛选范围内没有已落库的桌面端下载记录。" icon={Download} /> : null}
          {data ? <AdminPagination total={data.records.total} pages={data.records.pages} page={data.records.page} pageSize={data.records.pageSize} onPageChange={setPage} onPageSizeChange={(value) => {setPageSize(value);setPage(1);}} /> : null}
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
