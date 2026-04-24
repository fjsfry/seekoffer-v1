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
            我们会为你提供个人信息查阅、更正、删除和账号注销的申请通道。当前内测阶段可通过 feedback@seekoffer.com.cn 联系我们处理，正式版会把这些入口放到账号中心。
          </p>
          <div className="rounded-[26px] bg-slate-50 px-5 py-5">
            <div className="font-semibold text-ink">我们当前会处理的信息</div>
            <p className="mt-3">
              邮箱账号、个人资料、申请状态、工作台待办、收藏项目、手动录入项目、AI 内测需求和必要的操作日志。Offer 发布类功能正式开放前，会另行说明审核、匿名展示和删除规则。
            </p>
          </div>
          <div className="rounded-[26px] bg-slate-50 px-5 py-5">
            <div className="font-semibold text-ink">数据保存与删除</div>
            <p className="mt-3">
              账号数据用于维持申请工作台同步和服务安全。你可以申请导出、更正或删除个人资料；处理目的已经实现、你撤回同意或账号注销后，我们会按法律要求删除或停止继续处理。
            </p>
          </div>
          <div className="rounded-[26px] bg-slate-50 px-5 py-5">
            <div className="font-semibold text-ink">重要说明</div>
            <p className="mt-3">
              Seekoffer 会尽力保护你的申请数据，但你也应避免在备注、Offer 动态或反馈中填写身份证号、准考证号、完整住址等非必要敏感信息。
            </p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
