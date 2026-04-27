import { AlertTriangle, CheckCircle2, Clock3, Database, ShieldCheck } from 'lucide-react';
import { SiteShell } from '@/components/site-shell';

const qualityTiers = [
  {
    level: 'P0',
    title: '前台绝不展示',
    description: '测试数据、乱码、明显错误院校、无效截止时间会被数据卫生层拦截，不进入首页、通知库和截止提醒。',
    tone: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  {
    level: 'P1',
    title: '不进入默认通知主流',
    description: '竞赛、科研训练、非保研相关公告会从默认保研通知流移出，后续进入“竞赛科研 / 相关资源”承接。',
    tone: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    level: 'P2',
    title: '允许展示但明显标注',
    description: '学院待补充、来源待抽检、字段缺失等数据可以展示，但会提示“待补充 / 待核验”，并保留原文核对入口。',
    tone: 'bg-sky-50 text-sky-700 border-sky-200'
  }
] as const;

const workflow = [
  '从院校官网、研究生院、学院公告和公开招生入口同步通知。',
  '进入前台前执行测试数据、乱码、竞赛类公告和无效截止时间过滤。',
  '列表页优先展示保研夏令营、预推免、正式推免等主流程通知。',
  '详情页保留原文链接、录入时间、最近更新时间、核验状态和纠错入口。',
  '用户反馈后进入人工复核队列，确认后修正字段或下线异常项目。'
];

export default function DataQualityPage() {
  return (
    <SiteShell>
      <section className="page-hero px-6 py-8 lg:px-8">
        <div className="eyebrow">Data Quality</div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink md:text-5xl">数据如何更新与核验</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
          Seekoffer 的第一资产是可信。我们会把公开通知自动同步、质量分级、人工抽检和用户纠错放进同一条流程里，
          尽量让你看到的是可核对、可解释、可纠错的申请信息。
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {[
          { label: '同步频率', value: '持续同步', hint: '爬虫任务按固定频率抓取公开通知', icon: Database },
          { label: '时间口径', value: '北京时间', hint: '截止提醒统一按 Asia/Shanghai 计算', icon: Clock3 },
          { label: '纠错入口', value: '逐条反馈', hint: '通知详情页提供错误反馈邮件入口', icon: ShieldCheck }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="product-card rounded-[24px] p-6">
              <Icon className="h-7 w-7 text-brand" />
              <div className="mt-5 text-sm font-semibold text-slate-500">{item.label}</div>
              <div className="mt-2 text-3xl font-semibold text-ink">{item.value}</div>
              <p className="mt-3 text-sm leading-7 text-slate-500">{item.hint}</p>
            </div>
          );
        })}
      </section>

      <section className="product-card rounded-[30px] p-6 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-brand" />
          <h2 className="text-2xl font-semibold text-ink">数据质量分级</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {qualityTiers.map((tier) => (
            <div key={tier.level} className={`rounded-[24px] border p-5 ${tier.tone}`}>
              <div className="text-sm font-bold tracking-[0.2em]">{tier.level}</div>
              <div className="mt-3 text-xl font-semibold">{tier.title}</div>
              <p className="mt-3 text-sm leading-7 opacity-90">{tier.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="surface-card rounded-[30px] p-6">
          <h2 className="text-2xl font-semibold text-ink">更新与纠错流程</h2>
          <div className="mt-6 grid gap-3">
            {workflow.map((item, index) => (
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
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-ink">我们不会承诺“零错误”</h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            院校通知会发生改期、补充材料、入口调整等变化。Seekoffer 会尽力同步和核对，但正式报名、材料要求和截止时间
            仍请以院校官网原文为准。你发现问题时，可以通过通知详情页的“反馈通知错误”入口告诉我们。
          </p>
          <a
            href="mailto:seekoffer@qq.com"
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white"
          >
            反馈数据问题
          </a>
        </aside>
      </section>
    </SiteShell>
  );
}
