import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { AdminButton, AdminInput, AdminPanel, AdminSelect } from '@/components/admin-ui';

export default function AdminNewNoticePage() {
  return (
    <AdminShell title="新建通知" description="当爬虫漏抓、原站结构混乱，或者需要临时补录重点院校时，可以从这里手工录入。">
      <div className="space-y-6">
        <Link href="/admin/notices" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
          <ArrowLeft className="h-4 w-4" />
          返回通知管理
        </Link>

        <AdminPanel title="基础信息">
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <AdminInput placeholder="通知标题" />
            <AdminInput placeholder="学校名称" />
            <AdminInput placeholder="学院 / 项目" />
            <AdminSelect options={['通知类型', '夏令营', '预推免', '九推', '招生通知', '其他']} />
            <AdminInput placeholder="官方原文链接" />
            <AdminInput placeholder="报名入口" />
            <AdminInput placeholder="发布时间，例如 2026-04-28" />
            <AdminInput placeholder="截止时间，例如 2026-05-15 23:59" />
          </div>
        </AdminPanel>

        <AdminPanel title="内容与审核">
          <div className="grid gap-5 p-5">
            <textarea className="min-h-[120px] rounded-lg border border-slate-200 p-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" placeholder="摘要：用于前台卡片和搜索结果展示" />
            <textarea className="min-h-[220px] rounded-lg border border-slate-200 p-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" placeholder="正文：材料要求、申请条件、时间节点、联系方式等" />
            <textarea className="min-h-[100px] rounded-lg border border-slate-200 p-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" placeholder="管理员备注：重复检测、来源核验、待确认字段等" />
            <div className="flex justify-end gap-3">
              <AdminButton tone="secondary">保存草稿</AdminButton>
              <AdminButton>
                <Save className="mr-2 h-4 w-4" />
                提交审核
              </AdminButton>
            </div>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
