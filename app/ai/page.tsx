'use client';

import { useState } from 'react';
import { BrainCircuit, Sparkles } from 'lucide-react';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { submitAiWaitlistLead, type AiWaitlistNeed } from '@/lib/cloudbase-data';

const needOptions: AiWaitlistNeed[] = ['测算胜率', '精修申请表', '提炼简章要求'];

export default function AiPage() {
  const [wechatId, setWechatId] = useState('');
  const [primaryNeed, setPrimaryNeed] = useState<AiWaitlistNeed>('测算胜率');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!wechatId.trim()) {
      setMessage('请先留下微信号，方便后续发放内测码。');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const result = await submitAiWaitlistLead({
        wechatId,
        primaryNeed,
        details
      });

      setSubmitted(true);
      setMessage(
        result.ok ? '已登记内测需求，我们会根据你的微信号优先联系。' : '已记录需求，但云端写入暂时失败，请稍后再试。'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="AI Lab"
        title="Seekoffer 胜率预测大模型"
        subtitle="基于 2024-2025 届真实录取样本与项目字段做深度调优。当前开放内测收集，不做空能力堆叠，只先收最真实的需求。"
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <div className="surface-card rounded-[34px] p-7">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
            <BrainCircuit className="h-4 w-4" />
            模型能力方向
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">先把最真实、最刚需的问题收集清楚。</h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            我们不会让“AI”只是一个吸引点击的空入口。当前内测收集会直接沉淀你的联系方式和需求方向，用来决定模型优先做什么。
          </p>

          <div className="mt-6 grid gap-4">
            {[
              {
                title: '测算胜率',
                text: '围绕背景、目标层级、时间窗口和项目画像，输出更贴近现实的区间判断。'
              },
              {
                title: '精修申请表',
                text: '把通知、材料进度和高风险 Deadline 接成一条真正可执行的申请路径。'
              },
              {
                title: '提炼简章要求',
                text: '把冗长通知拆成关键条件、材料清单、时间节点和风险提醒。'
              }
            ].map((item) => (
              <div key={item.title} className="rounded-[28px] bg-slate-50 px-5 py-5">
                <div className="text-lg font-semibold text-ink">{item.title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[28px] bg-brand p-5 text-white">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/85">
              <Sparkles className="h-4 w-4" />
              当前状态
            </div>
            <p className="mt-3 text-sm leading-7 text-white/80">
              为保证预测的严谨性，模型正在做最后一轮参数调优。当前先收集前 500 位内测用户的真实需求。
            </p>
          </div>
        </div>

        <section className="surface-card rounded-[34px] p-7">
          <div className="text-sm font-semibold text-brand">内测登记表</div>
          <h3 className="mt-3 text-2xl font-semibold text-ink">留下联系方式和最想让 AI 解决的问题</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            我们会根据需求密度和方向优先发放内测资格，后续回访也会以你留下的微信号为准。
          </p>

          <div className="mt-6 grid gap-4">
            <Field label="微信号">
              <input
                value={wechatId}
                onChange={(event) => setWechatId(event.target.value)}
                placeholder="例如：seekoffer_xxx"
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>

            <Field label="你最希望 AI 先解决什么问题？">
              <div className="grid gap-3">
                {needOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPrimaryNeed(option)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      primaryNeed === option
                        ? 'border-brand bg-brand-cream text-brand'
                        : 'border-black/5 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="补充说明">
              <textarea
                rows={5}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="例如：最想知道某个院校今年的机会变化，或者希望系统自动整理简章字段。"
                className="w-full rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm outline-none"
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || submitted}
                className="rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitted ? '已完成登记' : submitting ? '提交中...' : '提交内测需求'}
              </button>
              {message ? <span className="text-sm text-slate-500">{message}</span> : null}
            </div>
          </div>
        </section>
      </section>
    </SiteShell>
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
