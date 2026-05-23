import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { QQ_GROUP_NUMBER } from '@/lib/contact';

export default function CommunityPage() {
  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Community Rules"
        title="Offer 池社区规范"
        subtitle="Offer 流动信息会影响他人判断，所以真实、克制和可纠错比热闹更重要。"
      />

      <section className="surface-card rounded-[34px] p-7 text-sm leading-8 text-slate-600">
        <div className="grid gap-5">
          <p>Offer 发布通道已要求发布者登录账号，所有内容提交后先进入审核队列，通过后才会公开展示。</p>
          <p>禁止编造他人去向、冒充老师或同学、泄露手机号/微信号/身份证号等隐私信息，也不要发布未经确认的录取承诺。</p>
          <p>用户可以选择匿名展示，但仍需对自己发布的信息负责，避免给其他同学造成误导。</p>
          <p>任何人发现疑似虚假、侵权或误导信息，都可以在 Offer 卡片上直接举报，也可以通过 seekoffer@qq.com 或 QQ 交流群 {QQ_GROUP_NUMBER} 联系我们。</p>
        </div>
      </section>
    </SiteShell>
  );
}
