'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { AdminButton, AdminPanel } from '@/components/admin-ui';
import { invokeAdminApi } from '@/lib/admin-api';

export default function AdminNewNoticePage() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    school_name: '',
    department_name: '',
    project_name: '',
    project_type: '夏令营',
    source_link: '',
    apply_link: '',
    publish_date: '',
    deadline_date: '',
    requirements: '',
    remarks: ''
  });

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitNotice() {
    if (!form.school_name.trim() || !form.project_name.trim()) {
      setMessage('请至少填写学校名称和通知标题。');
      return;
    }

    setPending(true);
    setMessage('');
    try {
      await invokeAdminApi({
        resource: 'notices',
        action: 'create',
        notice: form
      });
      setMessage('通知已提交到 Supabase，状态为待审核。');
      setForm({
        school_name: '',
        department_name: '',
        project_name: '',
        project_type: '夏令营',
        source_link: '',
        apply_link: '',
        publish_date: '',
        deadline_date: '',
        requirements: '',
        remarks: ''
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '提交失败，请稍后重试。');
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell title="新建通知" description="当爬虫漏抓、原站结构混乱，或者需要临时补录重点院校时，可以从这里手工录入。">
      <div className="space-y-6">
        <Link href="/admin/notices" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
          <ArrowLeft className="h-4 w-4" />
          返回通知管理
        </Link>

        <AdminPanel title="基础信息">
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <ControlledInput placeholder="通知标题" value={form.project_name} onChange={(value) => updateField('project_name', value)} />
            <ControlledInput placeholder="学校名称" value={form.school_name} onChange={(value) => updateField('school_name', value)} />
            <ControlledInput placeholder="学院 / 项目" value={form.department_name} onChange={(value) => updateField('department_name', value)} />
            <label className="grid gap-2">
              <select
                value={form.project_type}
                onChange={(event) => updateField('project_type', event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              >
                {['夏令营', '预推免', '九推', '招生通知', '其他'].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <ControlledInput placeholder="官方原文链接" value={form.source_link} onChange={(value) => updateField('source_link', value)} />
            <ControlledInput placeholder="报名入口" value={form.apply_link} onChange={(value) => updateField('apply_link', value)} />
            <ControlledInput placeholder="发布时间，例如 2026-04-28" value={form.publish_date} onChange={(value) => updateField('publish_date', value)} />
            <ControlledInput placeholder="截止时间，例如 2026-05-15 23:59" value={form.deadline_date} onChange={(value) => updateField('deadline_date', value)} />
          </div>
        </AdminPanel>

        <AdminPanel title="内容与审核">
          <div className="grid gap-5 p-5">
            <textarea
              value={form.requirements}
              onChange={(event) => updateField('requirements', event.target.value)}
              className="min-h-[220px] rounded-lg border border-slate-200 p-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              placeholder="正文：材料要求、申请条件、时间节点、联系方式等"
            />
            <textarea
              value={form.remarks}
              onChange={(event) => updateField('remarks', event.target.value)}
              className="min-h-[100px] rounded-lg border border-slate-200 p-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              placeholder="管理员备注：重复检测、来源核验、待确认字段等"
            />
            {message ? <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div> : null}
            <div className="flex justify-end gap-3">
              <AdminButton tone="secondary">保存草稿</AdminButton>
              <AdminButton onClick={submitNotice} disabled={pending}>
                <Save className="mr-2 h-4 w-4" />
                {pending ? '提交中...' : '提交审核'}
              </AdminButton>
            </div>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}

function ControlledInput({
  placeholder,
  value,
  onChange
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
    />
  );
}
