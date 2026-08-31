import { ArrowUpRight, Clock3, ClipboardCheck, MessageCircle, ShieldCheck } from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { QQ_GROUP_NUMBER, QQ_GROUP_URL } from '@/lib/contact';

const qualityCards = [
  {
    title: '字段结构化',
    description: '把通知拆成学校、学院、项目类型、截止时间、材料清单和报名入口，减少用户反复阅读的成本。',
    icon: ClipboardCheck
  },
  {
    title: '时间统一展示',
    description: '列表和详情页会尽量把发布时间、截止时间和活动时间拆开展示，方便判断下一步要先处理什么。',
    icon: Clock3
  },
  {
    title: '提交前再确认',
    description: '材料要求、报名入口、考核安排和录取规则可能调整，正式提交前请再次核对学校页面与报名系统。',
    icon: ShieldCheck
  }
] as const;

export default function DataQualityPage() {
  return (
    <SiteShell>
      <div className="desktop-secondary-page desktop-data-quality-page desktop-reading-page space-y-8 lg:space-y-10">
      <section className="desktop-secondary-header page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">通知整理说明</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            寻鹿会把分散的保研通知整理成更容易筛选、收藏和推进的申请信息。
          </p>
        </div>
        <div className="desktop-secondary-summary mx-auto grid w-full max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-3 lg:mx-0 lg:justify-self-center">
          {qualityCards.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="soft-stat-pill rounded-[28px] px-4 py-4">
                <div className="flex items-center justify-center gap-3 text-center">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/8 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="whitespace-nowrap text-sm font-semibold text-ink">{item.title}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {qualityCards.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="product-card rounded-[28px] p-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-cream text-brand">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-ink">{item.title}</h2>
              <p className="mt-3 text-sm leading-8 text-slate-600">{item.description}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="surface-card rounded-[30px] p-6 lg:p-8">
          <h2 className="text-2xl font-semibold text-ink">使用时建议重点看这三项</h2>
          <div className="mt-6 grid gap-3">
            {[
              '先看通知标题、院校和学院是否与你的目标方向匹配。',
              '再看截止时间和报名入口，优先处理临近截止的项目。',
              '提交材料前再次核对附件、格式和最新安排。'
            ].map((item, index) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span className="text-sm leading-7 text-slate-600">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="surface-card rounded-[30px] p-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-brand">
            <MessageCircle className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-ink">发现遗漏或错误？</h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            可以直接加入 QQ 交流群 {QQ_GROUP_NUMBER}，把通知链接或截图发给我们。我们会优先处理影响截止时间、报名入口和材料要求的问题。
          </p>
          <a
            href={QQ_GROUP_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
          >
            加入 QQ 群
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </aside>
      </section>
      </div>
    </SiteShell>
  );
}
