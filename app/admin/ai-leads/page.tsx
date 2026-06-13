'use client';

import { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, CalendarClock, Download, FileSearch, FileText, Search, ShieldAlert, Sparkles } from 'lucide-react';
import {
  AdminActionBanner,
  AdminEmptyState,
  AdminFilterSummary,
  AdminInput,
  AdminMetricCard,
  AdminPagination,
  AdminPanel,
  AdminSelect,
  AdminStatusBadge
} from '@/components/admin-ui';
import { AdminShell } from '@/components/admin-shell';
import { getAdminErrorMessage, invokeAdminApi } from '@/lib/admin-api';
import type { AdminMetric } from '@/lib/admin-data';
import { formatBeijingDateTime } from '@/lib/admin-time';

type AiWaitlistNeed = '申请风险评估' | '材料短板提示' | '提炼简章要求';

type AiWaitlistApiRow = {
  id: string;
  user_id: string | null;
  wechat_id: string;
  primary_need: AiWaitlistNeed | string;
  details: string;
  submitted_at_text: string;
  source: string;
  created_at: string;
};

type AiWaitlistMetricsPayload = {
  totalLeads: number;
  todayLeads: number;
  riskLeads: number;
  materialLeads: number;
  briefLeads: number;
};

type AiWaitlistResponse = {
  aiWaitlistLeads: AiWaitlistApiRow[];
  total: number;
  page: number;
  pageSize: number;
  metrics: AiWaitlistMetricsPayload;
};

const needOptions = ['全部需求', '申请风险评估', '材料短板提示', '提炼简章要求'];

function buildAiMetrics(metrics?: AiWaitlistMetricsPayload): AdminMetric[] {
  const data = metrics || {
    totalLeads: 0,
    todayLeads: 0,
    riskLeads: 0,
    materialLeads: 0,
    briefLeads: 0
  };

  return [
    { label: '总提交数', value: formatNumber(data.totalLeads), hint: '累计内测登记', tone: 'blue' },
    { label: '今日新增', value: formatNumber(data.todayLeads), hint: '北京时间今日', tone: 'green' },
    { label: '风险评估', value: formatNumber(data.riskLeads), hint: '目标层级与优先级', tone: 'amber' },
    { label: '材料短板', value: formatNumber(data.materialLeads + data.briefLeads), hint: `简章提炼 ${formatNumber(data.briefLeads)} 条`, tone: 'purple' }
  ];
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value || 0);
}

function formatSource(source: string) {
  if (source === 'ai-page') return 'AI 定位页';
  return source || '未知来源';
}

function formatUserId(userId: string | null) {
  if (!userId) return '匿名提交';
  return `${userId.slice(0, 8)}...${userId.slice(-6)}`;
}

function exportLeads(leads: AiWaitlistApiRow[]) {
  const header = ['提交时间', '微信号', '需求方向', '补充说明', '用户ID', '来源'];
  const lines = leads.map((item) =>
    [
      formatBeijingDateTime(item.created_at),
      item.wechat_id,
      item.primary_need,
      item.details || '',
      item.user_id || '',
      formatSource(item.source)
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(',')
  );
  const blob = new Blob([`\uFEFF${[header.join(','), ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `seekoffer-ai-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

export default function AdminAiLeadsPage() {
  const [leads, setLeads] = useState<AiWaitlistApiRow[]>([]);
  const [metrics, setMetrics] = useState<AdminMetric[]>(buildAiMetrics());
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState('');
  const [primaryNeed, setPrimaryNeed] = useState('全部需求');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('正在读取 AI 内测登记数据...');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const selectedLead = useMemo(
    () => leads.find((item) => item.id === selectedLeadId) || leads[0] || null,
    [leads, selectedLeadId]
  );

  useEffect(() => {
    void loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLeads(overrides: Partial<{ page: number; pageSize: number; query: string; primaryNeed: string }> = {}) {
    const nextPage = overrides.page ?? page;
    const nextPageSize = overrides.pageSize ?? pageSize;
    const nextQuery = overrides.query ?? query;
    const nextPrimaryNeed = overrides.primaryNeed ?? primaryNeed;

    setLoading(true);
    try {
      const response = await invokeAdminApi<AiWaitlistResponse>({
        resource: 'ai_waitlist',
        action: 'list',
        page: nextPage,
        pageSize: nextPageSize,
        filters: {
          query: nextQuery,
          primaryNeed: nextPrimaryNeed
        }
      });

      setLeads(response.aiWaitlistLeads || []);
      setTotal(response.total || 0);
      setPage(response.page || nextPage);
      setPageSize(response.pageSize || nextPageSize);
      setMetrics(buildAiMetrics(response.metrics));
      setSelectedLeadId((current) => {
        if (current && response.aiWaitlistLeads?.some((item) => item.id === current)) return current;
        return response.aiWaitlistLeads?.[0]?.id || null;
      });
      setMessage('AI 内测登记已更新，当前列表展示最新提交记录。');
    } catch (error) {
      setLeads([]);
      setTotal(0);
      setMetrics(buildAiMetrics());
      setMessage(`AI 内测数据读取失败：${getAdminErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setQuery('');
    setPrimaryNeed('全部需求');
    void loadLeads({ page: 1, query: '', primaryNeed: '全部需求' });
  }

  return (
    <AdminShell title="AI 内测管理" description="查看 AI 申请定位助手的内测登记、需求方向和用户补充说明。">
      <div className="space-y-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => {
            const icons = [BrainCircuit, CalendarClock, ShieldAlert, FileText];
            return <AdminMetricCard key={metric.label} metric={metric} icon={icons[index]} />;
          })}
        </section>

        <AdminActionBanner tone={message.includes('失败') ? 'danger' : 'info'}>{message}</AdminActionBanner>

        <AdminPanel>
          <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_220px_120px_120px]">
            <div onKeyDown={(event) => event.key === 'Enter' && void loadLeads({ page: 1 })}>
              <AdminInput
                placeholder="搜索微信号 / 需求方向 / 补充说明"
                value={query}
                onChange={setQuery}
              />
            </div>
            <AdminSelect options={needOptions} value={primaryNeed} onChange={setPrimaryNeed} />
            <button
              type="button"
              onClick={() => loadLeads({ page: 1 })}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Search className="mr-2 h-4 w-4" />
              查询
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              重置
            </button>
            <div className="xl:col-span-4">
              <AdminFilterSummary
                filters={[
                  { label: '关键词', value: query },
                  { label: '需求', value: primaryNeed, mutedValue: '全部需求' }
                ]}
                onClear={resetFilters}
              />
            </div>
          </div>
        </AdminPanel>

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <AdminPanel
            title="内测提交列表"
            action={
              <button
                type="button"
                onClick={() => exportLeads(leads)}
                disabled={!leads.length}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                导出当前页
              </button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-3">提交时间</th>
                    <th className="px-5 py-3">微信号</th>
                    <th className="px-5 py-3">需求方向</th>
                    <th className="px-5 py-3">补充说明</th>
                    <th className="px-5 py-3">用户</th>
                    <th className="px-5 py-3">来源</th>
                    <th className="px-5 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length ? (
                    leads.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatBeijingDateTime(item.created_at)}</td>
                        <td className="px-5 py-4 font-medium text-slate-950">{item.wechat_id}</td>
                        <td className="px-5 py-4">
                          <AdminStatusBadge status={item.primary_need} />
                        </td>
                        <td className="max-w-[320px] truncate px-5 py-4 text-slate-600">{item.details || '未填写'}</td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-500">{formatUserId(item.user_id)}</td>
                        <td className="px-5 py-4 text-slate-600">{formatSource(item.source)}</td>
                        <td className="px-5 py-4">
                          <button className="text-sm font-semibold text-blue-600" onClick={() => setSelectedLeadId(item.id)}>
                            查看
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : null}
                </tbody>
              </table>
            </div>
            {!leads.length ? (
              <AdminEmptyState
                icon={FileSearch}
                title={loading ? '正在加载内测登记' : '没有匹配的内测登记'}
                description={loading ? '系统正在读取 AI 内测提交记录，请稍候。' : '可以清空搜索条件，或确认前台表单是否已成功提交。'}
              />
            ) : null}
            <AdminPagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={(nextPage) => loadLeads({ page: nextPage })}
              onPageSizeChange={(nextPageSize) => loadLeads({ page: 1, pageSize: nextPageSize })}
            />
          </AdminPanel>

          <AdminPanel title="登记详情">
            <div className="p-5">
              {selectedLead ? (
                <div className="space-y-5">
                  <div className="rounded-2xl bg-slate-50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-slate-950">{selectedLead.wechat_id}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatBeijingDateTime(selectedLead.created_at)}</div>
                      </div>
                    </div>
                  </div>

                  <DetailList
                    items={[
                      ['需求方向', selectedLead.primary_need],
                      ['来源', formatSource(selectedLead.source)],
                      ['提交用户', formatUserId(selectedLead.user_id)],
                      ['前台提交时间', selectedLead.submitted_at_text || '-']
                    ]}
                  />

                  <div>
                    <div className="text-sm font-semibold text-slate-950">补充说明</div>
                    <div className="mt-3 min-h-32 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
                      {selectedLead.details || '用户未填写补充说明。'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  暂无登记详情。
                </div>
              )}
            </div>
          </AdminPanel>
        </div>
      </div>
    </AdminShell>
  );
}

function DetailList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="space-y-4 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-3 last:border-0">
          <dt className="text-slate-500">{label}</dt>
          <dd className="text-right font-medium text-slate-700">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
