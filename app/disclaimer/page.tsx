import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { QQ_GROUP_NUMBER } from '@/lib/contact';

export default function DisclaimerPage() {
  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Disclaimer"
        title="免责声明与使用边界"
        subtitle="Seekoffer 帮你整理信息和管理进度，但不替代学校正式要求、个人判断或最终录取结果。"
      />

      <section className="grid gap-5">
        {[
          ['通知整理', '通知库会持续整理公开保研信息，并尽力核对报名入口、材料要求、截止时间和录取规则。正式提交前，请再次核对学校页面与报名系统。'],
          ['Offer 圈', 'Offer 圈展示经过整理或核验的用户投稿与申请讨论，但社区动态仍可能存在延迟、遗漏或判断偏差。关键申请决策请结合学校通知、邮件或电话确认。'],
          ['工作台建议', '工作台中的截止提醒、材料清单和申请状态用于辅助管理，不构成录取承诺、升学保证、法律建议或任何确定性结论。'],
          ['信息反馈', `如果发现字段错误、链接失效、通知重复或疑似虚假内容，可以加入 QQ 交流群 ${QQ_GROUP_NUMBER} 告诉我们。`]
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
