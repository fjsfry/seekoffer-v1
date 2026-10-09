import Link from 'next/link';
import { SiteShell } from '@/components/site-shell';
import { PageHead, SupportNote } from '@/components/pro/billing-ui';
import s from '@/components/pro/pro.module.css';
export default function ProServicePage() {
  return <SiteShell><div className={s.page}><PageHead title="Pro 服务说明" subtitle="当前暂停购买。恢复售卖后，请在付款前核对最新的方案和订单摘要。" /><article className={s.card}><h2>商品范围与有效期</h2><p>网站 Pro 的三个方案提供相同权益，使用期限分别为 31、93、366 天。实际金额以方案目录及确认订单为准，一次性购买，不自动续费。</p><p>本商品不自动包含其他闪填产品、资料商品或未列入订单的服务。填报助手的网站连接尚未开放，不作为当前已交付的付费权益。</p><h2>开通与延长</h2><p>付款需要由服务端确认，并完成会员开通后生效。“付款已收到”不等于“会员已开通”。已有有效会员的延长从当前有效期结束后累计；已到期的会员从本次开通时起计算。页面时间按北京时间显示。</p><h2>到期与已有资料</h2><p>到期后已有项目和资料继续保留，可查看和管理。新增项目和资料传入按账号当前额度判断，历史超限不会要求你删除资料。</p><h2>付款结果与售后</h2><p>若付款结果不确定，请先查看“我的订单”，不要重复付款。发生重复付款、付款后未开通或其他订单问题，可携订单号联系支持。</p><p>退款需核对原订单与支付结果，提交售后申请不代表退款已经完成。可执行的退款由客服核对后按原支付路径处理，以订单中确认的结果为准。退款只处理对应订单，其他有效订单的权益应继续保留。</p><p>当前服务尚未恢复售卖。恢复前会提供正式生效的交易说明；你可以在确认页面重新核对后决定是否购买。</p><div className={s.actions}><Link className={s.secondary} href="/me/orders/">我的订单</Link><Link className={s.quiet} href="/pro/">返回 Pro</Link></div><SupportNote /></article></div></SiteShell>;
}
