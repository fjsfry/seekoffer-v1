import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { aboutOriginParagraphs, aboutPrinciples, aboutVisionParagraphs } from '@/lib/site-content';

export default function AboutPage() {
  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="About Seekoffer"
        title="关于我们"
        subtitle="寻鹿希望成为保研与升学申请过程中的个人作战台，让信息获取、节奏管理和关键决策都更清楚。"
      />

      <section className="surface-card rounded-[34px] p-7">
        <h2 className="text-2xl font-semibold text-ink">当前产品状态</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[
            ['阶段', '公开内测版。通知库、院校库、资源库可直接浏览，工作台和发布类动作需要登录。'],
            ['数据来源', '院校官网、公开通知入口和人工整理的资源入口；正式报名请以学校官网原文为准。'],
            ['更新频率', '通知数据会持续自动同步，重点字段逐步加入人工抽检和纠错反馈。'],
            ['反馈方式', '页面右下角“反馈与纠错”或邮件 feedback@seekoffer.com.cn。']
          ].map(([title, body]) => (
            <div key={title} className="rounded-[28px] bg-slate-50 px-5 py-5">
              <div className="text-sm font-semibold text-brand">{title}</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card rounded-[34px] p-7">
        <h2 className="text-2xl font-semibold text-ink">我们坚持的三件事</h2>
        <div className="mt-6 grid gap-4">
          {aboutPrinciples.map((item) => (
            <div key={item.title} className="rounded-[28px] bg-slate-50 px-5 py-5">
              <div className="text-lg font-semibold text-ink">{item.title}</div>
              <p className="mt-3 text-sm leading-8 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card rounded-[34px] p-7">
        <h2 className="text-2xl font-semibold text-ink">寻鹿想成为怎样的产品</h2>
        <div className="mt-5 grid gap-4 text-sm leading-8 text-slate-600">
          {aboutVisionParagraphs.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>

      <section className="surface-card rounded-[34px] p-7">
        <h2 className="text-2xl font-semibold text-ink">寻鹿 Seekoffer 诞生于一个很真实的问题</h2>
        <div className="mt-5 grid gap-4 text-sm leading-8 text-slate-600">
          {aboutOriginParagraphs.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
