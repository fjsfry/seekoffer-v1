import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';

export default function DisclaimerPage() {
  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Disclaimer"
        title="免责声明与数据说明"
        subtitle="Seekoffer 帮你整理信息，但不替代院校官网、个人判断或正式录取结果。"
      />

      <section className="grid gap-5">
        {[
          ['通知数据', '通知库来自院校官网和公开入口自动同步，并会逐步加入人工抽检。报名入口、材料要求、截止时间和录取规则请以院校官网原文为准。'],
          ['Offer 池', 'Offer 池在公开内测阶段展示演示数据。正式开放后，发布内容仍可能存在延迟或未核验信息，请勿单独依赖社区动态做关键申请决策。'],
          ['AI 功能', 'AI 申请定位助手仅用于辅助规划和材料梳理，不构成录取承诺、升学保证、法律建议或任何确定性结论。'],
          ['纠错反馈', '如果发现字段错误、原文链接失效、通知重复或疑似虚假内容，请通过页面纠错入口或 seekoffer@qq.com 告诉我们。']
        ].map(([title, body]) => (
          <section key={title} className="surface-card rounded-[30px] p-6">
            <h2 className="text-xl font-semibold text-ink">{title}</h2>
            <p className="mt-3 text-sm leading-8 text-slate-600">{body}</p>
          </section>
        ))}
      </section>
    </SiteShell>
  );
}
