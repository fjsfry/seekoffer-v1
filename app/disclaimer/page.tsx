import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { QQ_GROUP_NUMBER } from '@/lib/contact';

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
          ['通知数据', '通知库来自院校官网和公开入口整理。报名入口、材料要求、截止时间和录取规则请以院校官网原文为准。'],
          ['Offer 圈', 'Offer 圈展示核验通过的用户提交内容与申请讨论，但社区动态仍可能存在延迟、遗漏或判断偏差。关键申请决策请回到院校官方通知、邮件或电话确认。'],
          ['AI 功能', 'AI 申请定位助手仅用于辅助规划和材料梳理，不构成录取承诺、升学保证、法律建议或任何确定性结论。'],
          ['信息反馈', `如果发现字段错误、原文链接失效、通知重复或疑似虚假内容，可以加入 QQ 交流群 ${QQ_GROUP_NUMBER} 告诉我们。`]
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
