import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';

export default function TermsPage() {
  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Terms"
        title="用户协议"
        subtitle="使用 Seekoffer 前，请先了解账号、内容、数据和服务边界。"
      />

      <section className="surface-card rounded-[34px] p-7 text-sm leading-8 text-slate-600">
        <div className="grid gap-5">
          <p>
            Seekoffer 当前处于公开内测阶段，提供保研通知聚合、院校与资源入口、个人申请工作台、Offer 池演示和 AI 内测登记等功能。
          </p>
          <p>
            你应保证账号信息和主动发布内容真实、合法，不得冒充他人、编造 Offer 流向、发布侵犯他人隐私或误导申请决策的信息。
          </p>
          <p>
            通知、截止时间和材料要求会尽力清洗与核对，但最终解释和正式要求以院校官网原文为准。因用户未核对原文或自行决策造成的后果，需要由用户自行判断承担。
          </p>
          <p>
            如发现数据错误、账号异常、侵权内容或需要删除个人数据，请通过 feedback@seekoffer.com.cn 联系我们。
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
