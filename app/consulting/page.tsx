import type { Metadata } from 'next';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  HelpCircle,
  Mail,
  MessageCircle,
  Target,
  UsersRound
} from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { QQ_GROUP_NUMBER, QQ_GROUP_URL } from '@/lib/contact';

export const metadata: Metadata = {
  title: '保研咨询 - 寻鹿 Seekoffer',
  description: '面向保研申请的咨询服务说明，包含适合人群、服务流程、案例结构和常见问题。'
};

const serviceFlow = [
  {
    title: '整理背景',
    detail: '先收集成绩排名、目标方向、科研竞赛、英语和当前申请清单。',
    icon: ClipboardList
  },
  {
    title: '复核定位',
    detail: '围绕冲稳保比例、专业匹配、地区偏好和截止节奏做人工检查。',
    icon: Target
  },
  {
    title: '输出行动清单',
    detail: '给出下一步项目补充、材料优先级和需要二次确认的风险点。',
    icon: FileSearch
  }
];

const suitableGroups = [
  '不知道当前背景该冲哪些学校',
  '已经有清单，但项目组合过散或过窄',
  '材料准备到一半，担心简历和个人陈述重点不清',
  '夏令营结果不理想，需要调整预推免策略'
];

const caseFrames = [
  ['背景', '本科层次、排名、英语、科研竞赛和目标方向。'],
  ['问题', '清单过少、冲刺过多、材料短板或方向表达不清。'],
  ['调整', '补齐稳妥/保底项目，重排材料优先级，明确导师沟通重点。'],
  ['结果', '只记录申请过程和复盘结构，不承诺录取结果。']
];

const faqs = [
  ['会不会承诺录取？', '不会。我们只做信息整理、定位复核和行动建议，录取取决于院校要求、竞争环境和个人表现。'],
  ['什么时候需要保研咨询？', '当你已经有目标清单或材料初稿，但不确定组合、优先级和表达重点时，再做保研咨询更有效。'],
  ['需要准备哪些材料？', '一页简历、成绩排名、目标方向、科研竞赛经历、英语成绩和当前申请清单即可开始。'],
  ['适合什么时候做？', '夏令营投递前、夏令营结果后、预推免前都适合，越早做越容易调整组合。']
];

export default function ConsultingPage() {
  return (
    <SiteShell>
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">保研咨询</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">把背景、目标、材料和申请节奏整理清楚，形成更稳的下一步动作。</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={QQ_GROUP_URL} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-float">
              <MessageCircle className="h-4 w-4" />
              进入咨询交流群
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href="mailto:seekoffer@qq.com?subject=保研咨询申请" className="inline-flex h-12 items-center gap-2 rounded-xl border border-brand/20 bg-white px-5 text-sm font-semibold text-brand">
              <Mail className="h-4 w-4" />
              邮件咨询
            </a>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-3 lg:mx-0 lg:justify-self-center">
          {[
            ['定位复核', '冲稳保'],
            ['材料清单', '查短板'],
            ['申请节奏', '定动作']
          ].map(([label, value]) => (
            <div key={label} className="soft-stat-pill rounded-[28px] px-4 py-4">
              <div className="flex items-center justify-center gap-3 text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/8 text-brand">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="whitespace-nowrap text-xs text-slate-500">{label}</div>
                  <div className="whitespace-nowrap text-xl font-semibold text-ink">{value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] bg-brand px-6 py-7 text-white shadow-float sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">先说明问题，再判断是否需要服务</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/75">准备本科院校、排名区间、目标方向和当前申请清单。我们会先确认问题是否适合通过咨询解决，不做夸张承诺。</p>
          </div>
          <a href={QQ_GROUP_URL} target="_blank" rel="noreferrer" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-brand">
            联系寻鹿 · QQ 群 {QQ_GROUP_NUMBER}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section className="surface-card rounded-[34px] p-6 lg:p-8">
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/8 text-brand">
            <Target className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">服务流程</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">流程保持轻量，先把问题讲清楚，再输出能执行的清单。</p>
          </div>
        </div>
        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {serviceFlow.map((step, index) => {
            const Icon = step.icon;

            return (
              <article key={step.title} className="rounded-[26px] border border-slate-100 bg-white/95 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-ink">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">{step.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="surface-card rounded-[34px] p-6 lg:p-8">
          <div className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/8 text-brand">
              <UsersRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">适合人群</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">如果你只是想看通知，通知库已经足够；以下情况更适合保研咨询。</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3">
            {suitableGroups.map((item) => (
              <div key={item} className="rounded-2xl bg-white/95 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card rounded-[34px] p-6 lg:p-8">
          <div className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/8 text-brand">
              <FileSearch className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">案例结构</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">案例只展示分析框架，避免把个例包装成确定承诺。</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {caseFrames.map(([title, detail]) => (
              <div key={title} className="rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-sm">
                <div className="font-semibold text-ink">{title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-card rounded-[34px] p-6 lg:p-8">
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/8 text-brand">
            <HelpCircle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">常见问题</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">先把边界说清楚，用户才不会误解服务承诺。</p>
          </div>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {faqs.map(([question, answer]) => (
            <article key={question} className="rounded-[24px] border border-slate-100 bg-white/95 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-ink">{question}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">{answer}</p>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
