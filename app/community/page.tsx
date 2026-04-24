import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';

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
          <p>正式 Offer 发布通道开放后，我们会要求发布者登录账号，并对高风险内容进行审核或抽检。</p>
          <p>禁止编造他人去向、冒充老师或同学、泄露手机号/微信号/身份证号等隐私信息，也不要发布未经确认的录取承诺。</p>
          <p>用户可以选择匿名展示，但平台会保留必要账号记录用于反垃圾、纠错、举报处理和社区安全。</p>
          <p>任何人发现疑似虚假、侵权或误导信息，都可以通过举报入口或 feedback@seekoffer.com.cn 申请处理。</p>
        </div>
      </section>
    </SiteShell>
  );
}
