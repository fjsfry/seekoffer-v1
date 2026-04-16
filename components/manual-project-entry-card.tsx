'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Save } from 'lucide-react';
import { createManualApplicationEntry, type ManualProjectInput } from '@/lib/cloudbase-data';

const initialForm: ManualProjectInput = {
  schoolName: '',
  departmentName: '',
  projectName: '',
  projectType: '夏令营',
  discipline: '',
  deadlineDate: '',
  eventStartDate: '',
  eventEndDate: '',
  applyLink: ''
};

function formatDateTime(input: string) {
  if (!input) {
    return '';
  }

  return input.replace('T', ' ');
}

export function ManualProjectEntryCard({
  onCreated,
  compact = false
}: {
  onCreated?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [showMore, setShowMore] = useState(false);
  const [form, setForm] = useState<ManualProjectInput>(initialForm);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField<K extends keyof ManualProjectInput>(key: K, value: ManualProjectInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.schoolName.trim() || !form.projectName.trim() || !form.deadlineDate.trim()) {
      setMessage('请至少填写学校名称、项目名称和截止时间。');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      await createManualApplicationEntry({
        ...form,
        deadlineDate: formatDateTime(form.deadlineDate),
        eventStartDate: formatDateTime(form.eventStartDate || ''),
        eventEndDate: formatDateTime(form.eventEndDate || '')
      });

      setForm(initialForm);
      setShowMore(false);
      setMessage('项目已加入我的申请表，后续可以继续补充材料和备注。');
      onCreated?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="manual-entry" className="rounded-[30px] border border-black/5 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-ink">手动新增项目</div>
          <div className="mt-2 text-sm leading-7 text-slate-600">
            如果通知库暂时还没有收录某个项目，也可以先手动录入，先把目标院校和关键时间放进申请表。
          </div>
        </div>
        {compact ? (
          <button
            onClick={() => setOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <Plus className="h-4 w-4" />
            {open ? '收起录入' : '手动新增'}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="学校名称">
              <input
                value={form.schoolName}
                onChange={(event) => updateField('schoolName', event.target.value)}
                placeholder="例如 清华大学"
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>

            <Field label="项目名称">
              <input
                value={form.projectName}
                onChange={(event) => updateField('projectName', event.target.value)}
                placeholder="例如 2027 年预推免通知"
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>

            <Field label="截止时间">
              <input
                type="datetime-local"
                value={form.deadlineDate}
                onChange={(event) => updateField('deadlineDate', event.target.value)}
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={() => setShowMore((current) => !current)}
            className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showMore ? '收起更多选填项' : '展开更多选填项'}
          </button>

          {showMore ? (
            <div className="grid gap-4 rounded-[24px] bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="学院 / 系 / 实验室">
                <input
                  value={form.departmentName}
                  onChange={(event) => updateField('departmentName', event.target.value)}
                  placeholder="例如 电子工程系"
                  className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
                />
              </Field>

              <Field label="项目类型">
                <select
                  value={form.projectType}
                  onChange={(event) => updateField('projectType', event.target.value as ManualProjectInput['projectType'])}
                  className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
                >
                  {['夏令营', '预推免', '正式推免'].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="学科方向">
                <input
                  value={form.discipline}
                  onChange={(event) => updateField('discipline', event.target.value)}
                  placeholder="例如 计算机科学与技术"
                  className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
                />
              </Field>

              <Field label="原文或报名链接">
                <input
                  value={form.applyLink}
                  onChange={(event) => updateField('applyLink', event.target.value)}
                  placeholder="选填，方便后续回查"
                  className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
                />
              </Field>

              <Field label="活动开始时间">
                <input
                  type="datetime-local"
                  value={form.eventStartDate}
                  onChange={(event) => updateField('eventStartDate', event.target.value)}
                  className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
                />
              </Field>

              <Field label="活动结束时间">
                <input
                  type="datetime-local"
                  value={form.eventEndDate}
                  onChange={(event) => updateField('eventEndDate', event.target.value)}
                  className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none"
                />
              </Field>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {submitting ? '保存中...' : '加入我的申请表'}
            </button>
            {message ? <span className="text-sm text-slate-500">{message}</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-ink">{label}</div>
      {children}
    </label>
  );
}
