import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';

export default function PrivacyPage() {
  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Privacy Policy"
        title="隐私政策"
        subtitle="我们会尽量只收集产品运行必要的信息，并优先用它来帮助你管理申请进度，而不是制造额外打扰。"
      />

      <section className="surface-card rounded-[34px] p-7 text-sm leading-8 text-slate-600">
        <div className="grid gap-5">
          <p>
            寻鹿 Seekoffer 当前会在你使用申请表、待办、AI 内测登记等功能时，记录你主动提交的资料，例如昵称、院校信息、申请状态、备注、提醒设置和 AI
            需求登记信息。
          </p>
          <p>
            这些信息的目的只有一个：帮助你更高效地获取通知、更清晰地管理申请进度，并在你需要时提供待办与风险提醒。我们不会为了无关用途额外索取与你申请无关的隐私数据。
          </p>
          <p>
            在当前版本中，部分功能仍处于体验阶段。若涉及云端同步、账号登录和提醒能力扩展，我们会继续优化数据保护方式，并在能力正式上线后同步更新说明。
          </p>
          <p>
            如果你对信息使用方式、同步逻辑或隐私保护有疑问，可以先通过“关于我们”页面了解产品定位，后续我们也会持续补充更完整的服务说明。
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
