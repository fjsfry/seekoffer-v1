import { AnalyticsPreferenceControl } from '@/components/analytics-preference-control';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { QQ_GROUP_NUMBER } from '@/lib/contact';

const privacySections = [
  {
    title: '我们处理哪些信息',
    body: '账号注册时会处理邮箱、登录凭证状态和账号标识；你使用工作台时会处理主动填写的个人资料、目标项目、申请状态、日程、导师联系人和备注；你参与 Offer 圈时会处理投稿、回复、关注、举报和审核记录。请不要提交身份证号、完整住址、银行卡等与保研申请无关的敏感信息。'
  },
  {
    title: '处理信息的目的',
    body: '这些信息仅用于提供登录与跨设备同步、恢复申请进度、展示经核验的社区内容、处理举报纠错、保障账号安全和改进产品体验。我们不会把工作台资料、导师联系人、申请备注或浏览记录用于与本服务无关的商业营销和广告画像。'
  },
  {
    title: '不出售、不营销、不泄露',
    body: '我们不会出售、出租、交换个人信息，不会向广告商或其他无关第三方提供用户资料，也不会主动泄露你的工作台、联系人、社区互动和访问数据。只有在提供登录、托管、存储等必要服务，依法配合主管机关，或保护用户与平台合法权益时，才会在最小必要范围内处理或披露，并要求相关服务方承担保密与安全义务。'
  },
  {
    title: '匿名访问统计',
    body: '只有在你同意后，网站才会创建匿名访问设备标识，并记录页面路径、页面标题、来源页面、语言、时区、访问次数和在线状态，用于判断页面是否易用和发现运行异常。该标识不是注册账号，也不用于识别你的真实身份；你可以随时关闭。'
  },
  {
    title: '本机保存与云端同步',
    body: '未登录或同步失败时，部分工作台数据会暂存在当前浏览器。使用正式账号登录后，申请清单、日程和导师联系人会同步到个人云端空间。公共设备使用完成后，请主动退出账号并清理浏览器数据。'
  },
  {
    title: '保存期限',
    body: '账号和工作台数据一般保存至账号注销、你主动删除，或服务不再需要这些信息时；匿名访问和必要操作日志原则上不超过 180 天，安全事件、举报及依法需要留存的记录按处理所需的最短期限保存。到期后删除或匿名化。'
  },
  {
    title: '服务提供方与数据位置',
    body: '我们使用网站托管、内容分发、云数据库和身份认证服务提供产品能力，相关提供方只在完成托管、传输、登录和存储所需范围内处理信息。部分云服务可能部署在境外区域；涉及个人信息跨境处理时，我们会按照适用规则补充告知并采取必要保护措施。'
  },
  {
    title: '你的权利',
    body: '你可以申请查阅、复制、更正或删除个人信息，也可以撤回匿名统计选择、注销账号或要求说明处理规则。我们会核验账号归属，并在合理期限内答复；法律法规另有要求的除外。'
  },
  {
    title: '未成年人保护',
    body: '本产品主要面向高校学生。未满 14 周岁的用户不应自行注册或提交个人信息；确有需要时，应由监护人阅读并同意相关规则后联系我们。'
  },
  {
    title: '安全与事件处理',
    body: '我们通过访问控制、行级权限、内容审核、日志留痕和最小权限配置保护数据。若发生可能影响个人权益的安全事件，我们会及时处置，并按照适用规则告知风险、影响和补救方式。'
  }
];

export default function PrivacyPage() {
  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Privacy Policy"
        title="隐私政策"
        subtitle="所有数据规则集中在这里说明：收集什么、为什么使用、保存多久，以及你如何管理自己的信息。更新日期：2026 年 7 月 11 日。"
      />

      <section className="surface-card rounded-[30px] p-6 sm:p-7">
        <div className="rounded-[24px] bg-brand/5 px-5 py-5 text-sm leading-8 text-slate-600">
          <div className="font-semibold text-ink">个人信息处理者</div>
          <p className="mt-2">寻鹿 Seekoffer 运营团队。隐私、数据导出、删除和账号注销申请可发送至 <a href="mailto:seekoffer@qq.com" className="font-semibold text-brand">seekoffer@qq.com</a>，或通过 QQ 群 {QQ_GROUP_NUMBER} 联系我们。</p>
          <p className="mt-2 font-medium text-brand">我们不会出售用户信息，也不会将个人信息用于与提供本服务无关的商业营销或向无关第三方泄露。</p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {privacySections.map((section) => (
            <section key={section.title} className="rounded-[24px] border border-slate-100 bg-slate-50/70 px-5 py-5">
              <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
              <p className="mt-3 text-sm leading-8 text-slate-600">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-5">
          <AnalyticsPreferenceControl />
        </div>

        <p className="mt-5 text-xs leading-6 text-slate-400">
          本政策会随功能和法律要求更新。发生重要变化时，我们会通过页面提示等适当方式告知。涉及具体法律义务时，以适用法律法规及专业法律意见为准。
        </p>
      </section>
    </SiteShell>
  );
}
