'use client';
import Link from 'next/link';
import { ArrowLeft, Crown, ReceiptText, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { openAuthModal, writeAuthIntent } from '@/lib/auth-intent';
import { formatBillingDate, type BillingEntitlementResponse } from '@/lib/billing-api';
import type { BillingResource } from '@/hooks/use-billing-resource';
import s from './pro.module.css';
export function openBillingLogin(returnTo: string) {
  const target = /^\/(?:pro|checkout|me\/(?:membership|orders))\/(?:[?#].*)?$/.test(returnTo) ? returnTo : '/me/membership/';
  const intent = { type: 'open-workspace' as const, returnTo: target, reason: '登录后查看会员和订单', requiredAuth: 'member' as const };
  writeAuthIntent(intent); openAuthModal(intent);
}
export function AccountNav({ current }: { current: 'plans' | 'membership' | 'orders' }) {
  return <nav className={s.accountNav} aria-label="会员与订单">
    <div className={s.tabs}>
      <Link href="/pro/" aria-current={current === 'plans' ? 'page' : undefined}><Crown size={17} aria-hidden="true" />Pro 方案</Link>
      <Link href="/me/membership/" aria-current={current === 'membership' ? 'page' : undefined}><UserRound size={17} aria-hidden="true" />我的会员</Link>
      <Link href="/me/orders/" aria-current={current === 'orders' ? 'page' : undefined}><ReceiptText size={17} aria-hidden="true" />订单记录</Link>
    </div>
    <Link className={s.backLink} href="/me/"><ArrowLeft size={15} aria-hidden="true" />返回申请工作台</Link>
  </nav>;
}
export function ResourceState<T>({ resource, returnTo, noun, children }: {
  resource: BillingResource<T>; returnTo: string; noun: string; children: ReactNode;
}) {
  if (resource.state === 'guest') return <div className={s.empty}><h2>登录后查看{noun}</h2><p className={s.muted}>登录你的账号，查看自己的会员、用量和订单。</p><button className={s.primary} onClick={() => openBillingLogin(returnTo)}>登录 / 注册</button></div>;
  if (resource.state === 'loading') return <div className={s.skeleton} role="status" aria-live="polite">正在读取{noun}…</div>;
  if (resource.state === 'error') return <div className={s.notice} role="status" aria-live="polite"><p>暂时无法确认{noun}，请重试。</p><button className={s.quiet} onClick={() => void resource.refresh()}>重新读取 →</button></div>;
  return <>{children}</>;
}
export function membershipLabel(data: BillingEntitlementResponse) {
  return data.state === 'active' ? 'Pro 已开通' : data.state === 'expired' ? 'Pro 已到期' : '免费版';
}
export function membershipDescription(data: BillingEntitlementResponse) {
  return data.state === 'active' ? data.expiresAt ? '有效至 ' + formatBillingDate(data.expiresAt) + '（北京时间）' : '当前 Pro 权益有效'
    : data.state === 'expired' ? '已有资料继续保留，你可以查看和管理。' : '已有资料继续保留，新增项目按当前额度使用。';
}
export function SupportNote({ orderNumber }: { orderNumber?: string }) {
  const href = 'mailto:seekoffer@qq.com' + (orderNumber ? '?subject=' + encodeURIComponent('订单支持 ' + orderNumber) : '');
  return <p className={s.small}>需要协助？<a href={href}>seekoffer@qq.com</a>。联系时可提供订单号，请勿提供支付密码。</p>;
}
export function PageHead({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className={s.pageHead}><div><h1>{title}</h1><p className={s.muted}>{subtitle}</p></div>{action}</div>;
}
