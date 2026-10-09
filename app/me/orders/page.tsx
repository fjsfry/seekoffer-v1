'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SiteShell } from '@/components/site-shell';
import { fetchBillingOrders, formatBillingDate, formatPlanPrice, orderStatusLabel } from '@/lib/billing-api';
import { useBillingResource } from '@/hooks/use-billing-resource';
import { AccountNav, ResourceState, PageHead, SupportNote } from '@/components/pro/billing-ui';
import s from '@/components/pro/pro.module.css';

function OrdersContent() {
  const query = useSearchParams(), cursor = query.get('cursor');
  const resource = useBillingResource((ownerKey, signal) => fetchBillingOrders({ ownerKey, signal, cursor }), cursor ?? '');
  const returnTo = '/me/orders/' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '');
  return <div className={s.page}>
    <PageHead title="订单记录" subtitle="网站 Pro 的购买记录、付款状态与开通进度。"
      action={resource.state === 'ready' ? <button className={s.secondary} onClick={() => void resource.refresh()}>刷新</button> : undefined} />
    <AccountNav current="orders" />
    <ResourceState resource={resource} noun="订单" returnTo={returnTo}>
      {!resource.data?.orders.length ? <div className={s.empty}><h2>暂无订单</h2><p>你的网站 Pro 订单会显示在这里。</p><Link className={s.secondary} href="/pro/">查看 Pro 方案</Link></div>
        : <table className={s.historyTable}><caption className="sr-only">网站 Pro 订单记录</caption>
          <thead><tr><th scope="col">方案 / 订单号</th><th scope="col">创建时间</th><th scope="col">金额</th><th scope="col">状态</th><th scope="col"><span className="sr-only">操作</span></th></tr></thead>
          <tbody>{resource.data.orders.map(order => <tr key={order.id}>
            <td><strong>{order.planName}</strong><small>{order.supportNumber}</small></td>
            <td>{formatBillingDate(order.createdAt)}</td><td>{formatPlanPrice(order.amountCents)}</td>
            <td><span className={s.badge} data-status={order.status}>{orderStatusLabel(order)}</span></td>
            <td><Link className={s.quiet} href={'/checkout/?order=' + encodeURIComponent(order.id)} aria-label={'查看订单 ' + order.supportNumber}>详情 <span aria-hidden="true">→</span></Link></td>
          </tr>)}</tbody>
        </table>}
      <div className={s.purchase}><span className={s.small}>仅展示网站 Pro 订单；其他商品请前往对应产品查询。</span><div className={s.actions}>
        {cursor ? <Link className={s.secondary} href="/me/orders/">返回第一页</Link> : null}
        {resource.data?.nextCursor ? <Link className={s.secondary} href={'/me/orders/?cursor=' + encodeURIComponent(resource.data.nextCursor)}>下一页</Link> : null}
      </div></div>
    </ResourceState>
    <footer className={s.supportFooter}><SupportNote /></footer>
  </div>;
}
export default function OrdersPage() {
  return <SiteShell><Suspense fallback={<div className={s.skeleton}>正在读取订单…</div>}><OrdersContent /></Suspense></SiteShell>;
}
