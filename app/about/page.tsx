import { BellRing, CheckCircle2, ClipboardList, Mail, MessageCircle, Route, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { QQ_GROUP_NUMBER, QQ_GROUP_URL } from '@/lib/contact';
import { aboutOriginParagraphs, aboutPrinciples, aboutVisionParagraphs } from '@/lib/site-content';

const productStats = [
  { label: '通知整理', value: '持续更新', icon: BellRing },
  { label: '申请管理', value: '工作台', icon: ClipboardList },
  { label: '交流反馈', value: '社区共建', icon: Users }
];

const workflowSteps = [
  {
    title: '收集通知',
    body: '持续关注公开通知与院校页面，把分散信息纳入统一整理流程。',
    icon: BellRing
  },
  {
    title: '结构化字段',
    body: '拆出学校、学院、项目类型、截止时间、材料清单、报名入口等关键字段。',
    icon: ClipboardList
  },
  {
    title: '去重与校对',
    body: '合并重复项目，过滤竞赛或脏数据，优先保证用户真正需要的申请信息。',
    icon: ShieldCheck
  },
  {
    title: '持续补充',
    body: '后续更新材料、活动安排和变更记录，让通知不只是一次性浏览。',
    icon: Sparkles
  }
];

const productPromises = [
  '不夸大录取承诺，不把焦虑包装成噱头。',
  '不把用户的申请记录、导师联系和个人材料用于无关用途。',
  '不让后端术语、采集过程和内部字段打扰用户使用。',
  '发现错误及时修正，重要页面保留反馈入口。'
];

export default function AboutPage() {
  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="About Seekoffer"
        title="关于寻鹿"
        subtitle="寻鹿 Seekoffer 是面向保研申请全流程的信息整理与申请管理平台。我们希望把分散通知、截止节点、材料准备和交流反馈，整理成更清晰的申请路径。"
      />

      <section className="page-hero min-h-0 px-6 py-8 md:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-xs font-semibold text-brand shadow-sm">
              <Route className="h-4 w-4" />
              保研申请工作台
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
              把信息整理清楚，把申请推进下去
            </h1>
            <div className="mt-5 grid gap-4 text-sm leading-8 text-slate-600">
              {aboutOriginParagraphs.slice(0, 2).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            {productStats.map((item) => (
              <div key={item.label} className="rounded-3xl bg-white/85 px-5 py-5 shadow-soft">
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-mint text-brand">
                    <item.icon className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="text-sm text-slate-500">{item.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-ink">{item.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-card rounded-[34px] p-7">
        <h2 className="text-2xl font-semibold text-ink">我们如何整理通知</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          我们会把公开通知拆成可筛选、可收藏、可追踪的申请信息。页面上的重点不是展示采集过程，而是帮助你更快完成判断和操作。
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {workflowSteps.map((item) => (
            <div key={item.title} className="rounded-[28px] border border-slate-100 bg-slate-50/80 px-5 py-5">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand shadow-sm">
                <item.icon className="h-6 w-6" />
              </span>
              <div className="mt-5 text-lg font-semibold text-ink">{item.title}</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card rounded-[34px] p-7">
        <h2 className="text-2xl font-semibold text-ink">我们坚持的产品原则</h2>
        <div className="mt-6 grid gap-4">
          {aboutPrinciples.map((item) => (
            <div key={item.title} className="rounded-[28px] bg-slate-50 px-5 py-5">
              <div className="text-lg font-semibold text-ink">{item.title}</div>
              <p className="mt-3 text-sm leading-8 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="surface-card rounded-[34px] p-7">
          <h2 className="text-2xl font-semibold text-ink">寻鹿想成为怎样的产品</h2>
          <div className="mt-5 grid gap-4 text-sm leading-8 text-slate-600">
            {aboutVisionParagraphs.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <aside className="surface-card rounded-[34px] p-7">
          <h2 className="text-2xl font-semibold text-ink">我们的承诺</h2>
          <div className="mt-5 grid gap-3">
            {productPromises.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-brand" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="surface-card rounded-[34px] p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-ink">联系与反馈</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              如果你发现通知字段有误、希望补充院校信息，或想给产品提出建议，可以通过邮箱或 QQ 群联系寻鹿。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href="mailto:seekoffer@qq.com"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-brand shadow-sm"
            >
              <Mail className="h-4 w-4" />
              seekoffer@qq.com
            </a>
            <a
              href={QQ_GROUP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float"
            >
              <MessageCircle className="h-4 w-4" />
              QQ 群 {QQ_GROUP_NUMBER}
            </a>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
