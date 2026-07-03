import type { Metadata } from 'next';
import type { ComponentType } from 'react';
import Link from 'next/link';
import {
  BookOpenCheck,
  CalendarDays,
  FileText,
  HelpCircle,
  Layers3,
  MessageSquareText
} from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import {
  glossaryTerms,
  interviewQuestionGroups,
  materialGuide,
  stageComparison,
  timelineSteps
} from '@/lib/knowledge-content';

export const metadata: Metadata = {
  title: '保研知识中心 - 寻鹿 Seekoffer',
  description: '系统了解保研时间线、夏令营与预推免区别、材料准备、黑话词典和面试题。',
  alternates: {
    canonical: '/knowledge'
  },
  openGraph: {
    title: '保研知识中心 - 寻鹿 Seekoffer',
    description: '保研时间线、黑话词典、材料指南、面试题和申请阶段区别。',
    url: '/knowledge',
    siteName: '寻鹿 Seekoffer',
    images: ['/logo.png'],
    locale: 'zh_CN',
    type: 'website'
  }
};

const navCards = [
  { title: '保研时间线', href: '#timeline', icon: CalendarDays },
  { title: '黑话词典', href: '#glossary', icon: BookOpenCheck },
  { title: '阶段区别', href: '#comparison', icon: Layers3 },
  { title: '材料指南', href: '#materials', icon: FileText },
  { title: '面试题', href: '#interview', icon: MessageSquareText }
];

export default function KnowledgePage() {
  return (
    <SiteShell>
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">知识/经验中心</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">系统整理保研时间线、黑话词典、阶段区别、材料指南和面试题。</p>
        </div>

        <div className="mx-auto grid w-full max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-3 lg:mx-0 lg:justify-self-center">
          {navCards.slice(0, 3).map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="soft-stat-pill group rounded-[28px] px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="flex items-center justify-center gap-3 text-center">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/8 text-brand transition group-hover:bg-brand group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="whitespace-nowrap text-sm font-semibold text-ink">{item.title}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="timeline" className="surface-card scroll-mt-24 rounded-[34px] p-6 lg:p-8">
        <SectionTitle icon={CalendarDays} title="保研时间线" description="把全年节奏拆成可执行阶段，避免只在通知爆发时被动补材料。" />
        <div className="mt-7 grid gap-4 lg:grid-cols-5">
          {timelineSteps.map((step) => (
            <article key={step.period} className="rounded-[26px] border border-slate-100 bg-white/95 p-5 shadow-sm">
              <div className="inline-flex rounded-full bg-brand/8 px-3 py-1 text-xs font-semibold text-brand">{step.period}</div>
              <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">{step.detail}</p>
              <div className="mt-4 grid gap-2">
                {step.checklist.map((item) => (
                  <span key={item} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                    {item}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="glossary" className="surface-card scroll-mt-24 rounded-[34px] p-6 lg:p-8">
        <SectionTitle icon={BookOpenCheck} title="黑话词典" description="先理解这些词，才能更准确判断通知、经验贴和同学交流里的真实含义。" />
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {glossaryTerms.map(([term, detail]) => (
            <article key={term} className="rounded-[24px] border border-slate-100 bg-white/95 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-ink">{term}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="comparison" className="surface-card scroll-mt-24 rounded-[34px] p-6 lg:p-8">
        <SectionTitle icon={Layers3} title="夏令营 / 预推免 / 九推区别" description="三类入口不是互斥关系，而是申请节奏里的连续窗口。" />
        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {stageComparison.map((item) => (
            <article key={item.title} className="rounded-[26px] border border-slate-100 bg-white/95 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-ink">{item.title}</h3>
                <span className="rounded-full bg-brand/8 px-3 py-1 text-xs font-semibold text-brand">{item.timing}</span>
              </div>
              <div className="mt-5 rounded-2xl bg-emerald-50/70 p-4 text-sm leading-7 text-brand">{item.value}</div>
              <div className="mt-3 rounded-2xl bg-rose-50/70 p-4 text-sm leading-7 text-rose-600">{item.risk}</div>
            </article>
          ))}
        </div>
      </section>

      <section id="materials" className="surface-card scroll-mt-24 rounded-[34px] p-6 lg:p-8">
        <SectionTitle icon={FileText} title="材料指南" description="材料不是越多越好，关键是可验证、能复用、能按院校方向快速调整。" />
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {materialGuide.map((item) => (
            <article key={item.title} className="rounded-[26px] border border-slate-100 bg-white/95 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">{item.detail}</p>
              <div className="mt-4 grid gap-2">
                {item.points.map((point) => (
                  <span key={point} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                    {point}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="interview" className="surface-card scroll-mt-24 rounded-[34px] p-6 lg:p-8">
        <SectionTitle icon={MessageSquareText} title="面试题框架" description="不要只背答案，先把问题分组，再准备能支撑回答的经历和证据。" />
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {interviewQuestionGroups.map((group) => (
            <article key={group.title} className="rounded-[26px] border border-slate-100 bg-white/95 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                  <HelpCircle className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-semibold text-ink">{group.title}</h3>
              </div>
              <div className="mt-4 grid gap-3">
                {group.questions.map((question) => (
                  <div key={question} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                    {question}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/8 text-brand">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
