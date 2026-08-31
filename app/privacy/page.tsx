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
    body: '网站会进行匿名访问统计，并创建随机设备标识，记录页面路径、页面标题、来源页面、语言、时区、访问次数和在线状态，用于判断页面是否易用和发现运行异常。匿名统计不需要用户另行同意，不包含姓名、手机号、邮箱或工作台内容，不用于识别真实身份、广告画像、与本服务无关的商业营销或向无关第三方披露。'
  },
  {
    title: '本机保存与云端同步',
    body: '未登录或同步失败时，部分工作台数据会暂存在当前浏览器。使用正式账号登录后，申请清单、日程和导师联系人会同步到个人云端空间。公共设备使用完成后，请主动退出账号并清理浏览器数据。'
  },
  {
    title: '填报助手与浏览器插件',
    body: '填报助手只处理你主动选择并确认的姓名、联系方式、教育经历和申请目标字段。字段值在浏览器扩展会话中最长保存 30 分钟，可随时清空；报名页识别和填入在本机完成。插件只向寻鹿计费接口发送一次性随机令牌，用于核验免费次数或 Pro 权益，不向该接口发送字段值、报名页内容或浏览历史。密码、验证码、身份证号、银行卡号和文件上传内容不在扫描范围内。'
  },
  {
    title: '订单、支付与会员权益',
    body: '购买 Pro 时，我们会处理套餐、金额、支付渠道、寻鹿订单号、支付平台交易号、订单状态和权益有效期，用于创建订单、核验支付、开通权益、处理退款与客服争议。付款凭证和银行卡等金融信息由微信支付或支付宝处理，寻鹿不收集或保存支付密码、银行卡号。支付通知仅保留完成对账所需的最小字段，不保留付款人账号标识。'
  },
  {
    title: '保存期限',
    body: '账号和工作台数据一般保存至账号注销、你主动删除，或服务不再需要这些信息时；插件字段最长在本机扩展会话保存 30 分钟；填报用量、匿名访问和必要操作日志原则上不超过 180 天。订单、支付、退款和对账记录按照交易争议处理及适用法律要求保存；到期后删除或匿名化。'
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
      <div className="desktop-secondary-page desktop-reading-page desktop-legal-page desktop-privacy-page space-y-8 lg:space-y-10">
      <PageSectionTitle
        eyebrow="Privacy Policy"
        title="隐私政策"
        subtitle="所有数据规则集中在这里说明：收集什么、为什么使用、保存多久，以及你如何管理自己的信息。更新日期：2026 年 8 月 10 日。"
        level="h1"
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

        <p className="mt-5 text-xs leading-6 text-slate-400">
          本政策会随功能和法律要求更新。发生重要变化时，我们会通过页面提示等适当方式告知。涉及具体法律义务时，以适用法律法规及专业法律意见为准。
        </p>
      </section>
      </div>
    </SiteShell>
  );
}
