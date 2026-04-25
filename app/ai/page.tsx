'use client';

import { useState } from 'react';
import { BrainCircuit, Sparkles } from 'lucide-react';
import { PageSectionTitle } from '@/components/page-section-title';
import { ProductHeroVisual } from '@/components/product-hero-visual';
import { SiteShell } from '@/components/site-shell';
import { submitAiWaitlistLead, type AiWaitlistNeed } from '@/lib/cloudbase-data';

const needOptions: AiWaitlistNeed[] = ['申请风险评估', '材料短板提示', '提炼简章要求'];

export default function AiPage() {
  const [wechatId, setWechatId] = useState('');
  const [primaryNeed, setPrimaryNeed] = useState<AiWaitlistNeed>('申请风险评估');
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
      <section className="grid gap-8 py-5 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center">
        <PageSectionTitle
          eyebrow="AI Lab"
          title="AI 申请定位助手"
          subtitle="基于公开通知、申请字段和经验规则，辅助你判断目标层级、材料短板和申请优先级。"
        />
        <ProductHeroVisual variant="ai" compact />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <div className="surface-card rounded-[34px] p-7">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
            <BrainCircuit className="h-4 w-4" />
            模型能力方向
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">左手看风险，右手拆材料。</h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            内测阶段先聚焦三个最刚需的申请动作：判断目标层级、发现材料缺口、拆解简章要求。
          </p>

          <div className="mt-6 grid gap-4">
            {[
              {
                title: '申请风险评估',
                text: '判断目标层级与申请优先级，帮助你少做无效投递。'
              },
              {
                title: '材料短板提示',
                text: '检查简历、成绩单、推荐信、科研经历等关键缺口。'
              },
              {
                title: '提炼简章要求',
                text: '拆解申请条件、材料清单和时间节点。'
              }
            ].map((item) => (
              <div key={item.title} className="rounded-[24px] border border-slate-100 bg-white px-5 py-5 shadow-sm">
                <div className="text-lg font-semibold text-ink">{item.title}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[28px] bg-gradient-to-br from-brand to-brand-deep p-5 text-white shadow-float">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/85">
              <Sparkles className="h-4 w-4" />
              当前状态
            </div>
            <p className="mt-3 text-sm leading-7 text-white/80">
              AI 输出仅供申请规划参考，不构成录取承诺、升学保证或替代院校官网要求。当前先收集前 500 位内测用户的真实需求。
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
