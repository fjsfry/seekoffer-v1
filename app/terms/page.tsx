import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { QQ_GROUP_NUMBER } from '@/lib/contact';

export default function TermsPage() {
  return (
    <SiteShell>
      <div className="desktop-secondary-page desktop-reading-page desktop-legal-page desktop-terms-page space-y-8 lg:space-y-10">
      <PageSectionTitle
        eyebrow="Terms"
        title="用户协议"
        subtitle="使用 Seekoffer 前，请先了解账号、内容、数据和服务边界。"
        level="h1"
      />

      <section className="surface-card rounded-[34px] p-7 text-sm leading-8 text-slate-600">
        <div className="grid gap-5">
          <p>
            Seekoffer 提供保研通知整理、院校与资源入口、竞赛库、个人申请管理和 Offer 圈等功能。
          </p>
          <p>
            你应保证账号信息和主动发布内容真实、合法，不得冒充他人、编造 Offer 流向、发布侵犯他人隐私或误导申请决策的信息。
          </p>
          <p>
            通知、截止时间和材料要求会尽力清洗与核对，但正式报名、材料提交和结果确认，仍需要用户在提交前核对学校页面与报名系统。因用户自行决策造成的后果，需要由用户自行判断承担。
          </p>
          <p>
            填报助手只在你主动操作后识别和填入字段，不会处理密码、验证码和文件上传，也不会点击保存、下一步或提交。报名系统结构可能随时变化；低置信或存在歧义的字段会停止自动填入。你必须在提交前逐项核对全部内容，学校报名系统的最终记录具有优先效力。
          </p>
          <p>
            免费账号当前最多跟进 5 个申请项目，每月可向官方插件发送 3 组字段；页面识别、预览和未成功兑换授权的失败重试不消耗次数。Pro 的套餐价格、有效期和已包含权益以购买页面下单前展示为准。当前套餐为一次性购买，不自动续费；支付成功后服务立即开通，到期后回到免费权益，已保存且符合法律及产品规则的数据不会因到期被自动删除。
          </p>
          <p>
            若发生重复扣款、支付成功但权益未开通、订单金额不一致或其他系统故障，请保留寻鹿订单号，并在发现问题后尽快通过 seekoffer@qq.com 联系。我们核验后会补开权益或按原支付路径退款。其他退款申请会结合服务实际使用情况、支付渠道规则和适用法律处理；本协议不排除或限制消费者依法享有的权利。
          </p>
          <p>
            不得通过修改插件、伪造授权、共享账号、批量脚本或其他方式绕过免费额度、攻击支付和权益系统。为防止滥用，平台可以对异常高频请求进行限制，并在有合理证据时暂停相关账号；如有误判，可通过客服渠道申诉。
          </p>
          <p>
            如发现数据错误、账号异常、侵权内容或需要删除个人数据，请通过 seekoffer@qq.com 或 QQ 交流群 {QQ_GROUP_NUMBER} 联系我们。
          </p>
        </div>
      </section>
      </div>
    </SiteShell>
  );
}
