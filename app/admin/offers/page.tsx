'use client';

import { CheckCircle2, EyeOff, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import {
  AdminButton,
  AdminInput,
  AdminMetricCard,
  AdminPagination,
  AdminPanel,
  AdminSelect,
  AdminStatusBadge
} from '@/components/admin-ui';
import { adminOfferRows, offerMetrics } from '@/lib/admin-data';
import type { AdminOfferRow } from '@/lib/admin-data';
import { invokeAdminApi } from '@/lib/admin-api';

const offerIcons = [ShieldCheck, CheckCircle2, EyeOff, Trash2];

export default function AdminOffersPage() {
  const [rows, setRows] = useState<AdminOfferRow[]>(adminOfferRows);
  const [message, setMessage] = useState('正在连接后台真实 Offer 数据...');
  const [pending, setPending] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOffers();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function loadOffers() {
    setPending('load');
    try {
      const data = await invokeAdminApi<{ offers: OfferApiRow[] }>({ resource: 'offers', action: 'list' });
      setRows(data.offers.map(mapOfferApiRow));
      setMessage(`已连接 Supabase，加载 ${data.offers.length} 条 Offer。`);
    } catch (error) {
      setMessage(error instanceof Error ? `真实 API 暂不可用，当前显示降级数据：${error.message}` : '真实 API 暂不可用，当前显示降级数据。');
    } finally {
      setPending('');
    }
  }

  async function updateOfferStatus(id: string, status: string, note: string) {
    if ((status === 'deleted' || status === 'hidden') && !window.confirm('确认执行该操作吗？该操作会写入后台日志。')) {
      return;
    }

    setPending(`${status}:${id}`);
    try {
      await invokeAdminApi({
        resource: 'offers',
        action: 'update_status',
        id,
        status,
        note
      });
      setMessage('操作成功，已写入 Supabase 并记录日志。');
      await loadOffers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Offer 操作失败，请稍后重试。');
    } finally {
      setPending('');
    }
  }

  function previewOffer(offer: AdminOfferRow) {
    setMessage(`已打开 ${offer.school} · ${offer.major} 的 Offer 审核预览。`);
    window.alert(
      [
        `提交用户：${offer.user}`,
        `申请学校：${offer.school}`,
        `申请专业：${offer.major}`,
        `项目类型：${offer.projectType}`,
        `录取结果：${offer.result}`,
        `本科背景：${offer.background}`,
        `是否匿名：${offer.anonymous ? '是' : '否'}`,
        `提交时间：${offer.submittedAt}`,
        `审核状态：${offer.status}`
      ].join('\n')
    );
  }

  return (
    <AdminShell title="Offer池管理">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <AdminPanel>
            <div className="grid gap-5 p-5">
              <div className="grid gap-4 xl:grid-cols-5">
                <AdminSelect label="学校" options={['全部学校', '清华大学', '北京大学', '上海交通大学', '复旦大学']} />
                <AdminSelect label="专业" options={['全部专业', '计算机', '电子信息', '金融', '人工智能']} />
                <AdminSelect label="结果" options={['全部结果', '录取', '放弃', '候补', '补录传闻']} />
                <AdminSelect label="审核状态" options={['全部状态', '待审核', '已通过', '已隐藏', '已删除']} />
                <AdminInput placeholder="开始日期  至  结束日期" />
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_120px_120px]">
                <AdminInput placeholder="搜索学校、专业、用户昵称等" />
                <AdminButton onClick={loadOffers} disabled={pending === 'load'}>查询</AdminButton>
                <AdminButton
                  tone="secondary"
                  onClick={() => {
                    void loadOffers();
                    setMessage('Offer 筛选条件已重置，并重新加载真实 Offer 列表。');
                  }}
                >
                  重置
                </AdminButton>
              </div>
              <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>
            </div>
          </AdminPanel>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {offerMetrics.map((metric, index) => (
              <AdminMetricCard key={metric.label} metric={metric} icon={offerIcons[index]} />
            ))}
          </section>

          <AdminPanel title="Offer列表">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-3"><input type="checkbox" aria-label="选择全部 Offer" /></th>
                    <th className="px-5 py-3">提交用户</th>
                    <th className="px-5 py-3">申请学校</th>
                    <th className="px-5 py-3">申请专业</th>
                    <th className="px-5 py-3">项目类型</th>
                    <th className="px-5 py-3">录取结果</th>
                    <th className="px-5 py-3">本科背景</th>
                    <th className="px-5 py-3">是否匿名</th>
                    <th className="px-5 py-3">提交时间</th>
                    <th className="px-5 py-3">审核状态</th>
                    <th className="px-5 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((offer, index) => (
                    <tr key={`${offer.id}-${index}`} className="border-t border-slate-100">
                      <td className="px-5 py-4"><input type="checkbox" aria-label={`选择 ${offer.user}`} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                            {offer.avatar}
                          </div>
                          <span className="font-medium text-slate-900">{offer.user}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{offer.school}</td>
                      <td className="px-5 py-4 text-slate-700">{offer.major}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">{offer.projectType}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">{offer.result}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{offer.background}</td>
                      <td className="px-5 py-4 text-slate-700">{offer.anonymous ? '是' : '否'}</td>
                      <td className="px-5 py-4 text-slate-600">{offer.submittedAt}</td>
                      <td className="px-5 py-4"><AdminStatusBadge status={offer.status} /></td>
                      <td className="px-5 py-4">
                        <div className="flex gap-3 font-medium">
                          <button className="text-blue-600" onClick={() => previewOffer(offer)}>查看</button>
                          <button className="text-blue-600" onClick={() => updateOfferStatus(offer.id, 'approved', '审核通过 Offer')}>审核</button>
                          <button className="text-blue-600" onClick={() => updateOfferStatus(offer.id, 'hidden', '后台隐藏 Offer')}>隐藏</button>
                          <button className="text-rose-600" onClick={() => updateOfferStatus(offer.id, 'deleted', '后台删除 Offer')}>删除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination total={String(rows.length)} />
          </AdminPanel>
        </div>

        <AdminPanel title="审核提示">
          <div className="space-y-7 p-5 text-sm leading-7 text-slate-600">
            <ReviewTip title="检查隐私信息" body="确认 Offer 内容中是否包含姓名、邮箱、电话、地址、身份证号、学号等个人隐私信息。" />
            <ReviewTip title="检查广告引流" body="确认内容中是否存在引导添加微信、QQ群、外链、二维码等广告引流信息。" />
            <ReviewTip title="检查内容真实性" body="确认 Offer 内容真实有效，无显著夸大或误导性信息，维护社区可信度。" />
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}

type OfferApiRow = {
  id: string;
  author_name: string;
  school_name: string;
  major: string;
  project_type: string;
  result: string;
  undergraduate_background: string;
  is_anonymous: boolean;
  review_status: string;
  reports_count: number;
  created_at: string;
};

function mapOfferApiRow(row: OfferApiRow): AdminOfferRow {
  return {
    id: row.id,
    user: row.author_name || '匿名用户',
    avatar: (row.author_name || '匿').slice(0, 1),
    school: row.school_name || '待补充学校',
    major: row.major || '待补充专业',
    projectType: row.project_type || '其他',
    result: row.result || '待确认',
    background: row.undergraduate_background || '未填写',
    anonymous: row.is_anonymous,
    submittedAt: row.created_at?.slice(0, 16).replace('T', ' ') || '-',
    status: mapOfferStatus(row.review_status),
    reports: row.reports_count || 0
  };
}

function mapOfferStatus(status: string): AdminOfferRow['status'] {
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '已驳回';
  if (status === 'hidden') return '已隐藏';
  if (status === 'deleted') return '已删除';
  return '待审核';
}

function ReviewTip({ title, body }: { title: string; body: string }) {
  return (
    <div className="relative pl-5">
      <span className="absolute left-0 top-2 h-2 w-2 rounded-full bg-blue-600" />
      <div className="font-semibold text-slate-950">{title}</div>
      <p className="mt-2">{body}</p>
    </div>
  );
}
