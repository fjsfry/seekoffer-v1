'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { AdminButton, AdminInput, AdminPanel, AdminSelect } from '@/components/admin-ui';
import { getAdminErrorMessage, invokeAdminApi } from '@/lib/admin-api';

const emptyForm = {
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
};

export default function AdminNewNoticePage() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(emptyForm);

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function saveDraft() {
    window.localStorage.setItem(
      'seekoffer-admin-notice-draft',
      JSON.stringify({ ...form, savedAt: new Date().toISOString() })
    );
    setMessage('草稿已保存。');
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
      setMessage('通知已提交，当前状态为待审核。');
      setForm(emptyForm);
    } catch (error) {
      setMessage(getAdminErrorMessage(error, '提交失败，请稍后重试。'));
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell title="新建通知" description="补录或修正需要发布的申请信息。">
      <div className="space-y-6">
        <Link href="/admin/notices" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
          <ArrowLeft className="h-4 w-4" />
          返回通知管理
        </Link>

        <AdminPanel
          title="基础信息"
          description="请准确填写学校、学院与关键时间。"
        >
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <Field label="通知标题">
              <AdminInput placeholder="例如：2026年优秀大学生夏令营报名通知" value={form.project_name} onChange={(value) => updateField('project_name', value)} />
            </Field>
            <Field label="学校名称">
              <AdminInput placeholder="例如：清华大学" value={form.school_name} onChange={(value) => updateField('school_name', value)} />
            </Field>
            <Field label="学院 / 项目">
              <AdminInput placeholder="例如：五道口金融学院" value={form.department_name} onChange={(value) => updateField('department_name', value)} />
            </Field>
            <Field label="通知类型">
              <AdminSelect
                value={form.project_type}
                onChange={(value) => updateField('project_type', value)}
                options={['夏令营', '预推免', '正式推免', '招生通知', '其他']}
              />
            </Field>
            <Field label="官方原文链接">
              <AdminInput placeholder="https://..." value={form.source_link} onChange={(value) => updateField('source_link', value)} />
            </Field>
            <Field label="报名入口">
              <AdminInput placeholder="https://..." value={form.apply_link} onChange={(value) => updateField('apply_link', value)} />
            </Field>
            <Field label="发布时间">
              <AdminInput placeholder="例如：2026-05-19" value={form.publish_date} onChange={(value) => updateField('publish_date', value)} />
            </Field>
            <Field label="截止时间">
              <AdminInput placeholder="例如：2026-06-15 23:59" value={form.deadline_date} onChange={(value) => updateField('deadline_date', value)} />
            </Field>
          </div>
        </AdminPanel>

        <AdminPanel title="内容与审核" description="补充申请要求与核验备注。">
          <div className="grid gap-5 p-5">
            <Field label="正文 / 材料要求">
              <textarea
                value={form.requirements}
                onChange={(event) => updateField('requirements', event.target.value)}
                className="min-h-[200px] rounded-xl border border-slate-200 p-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-emerald-50"
                placeholder="填写材料要求、申请条件、时间节点、联系方式等。"
              />
            </Field>
            <Field label="管理员备注">
              <textarea
                value={form.remarks}
                onChange={(event) => updateField('remarks', event.target.value)}
                className="min-h-[96px] rounded-xl border border-slate-200 p-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-emerald-50"
                placeholder="例如：来源已核验，需二次确认学院名称。"
              />
            </Field>
            {message ? <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">{message}</div> : null}
            <div className="flex flex-wrap justify-end gap-3">
              <AdminButton tone="secondary" onClick={saveDraft}>
                保存草稿
              </AdminButton>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
