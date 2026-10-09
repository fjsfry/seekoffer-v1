'use client';

import Link from 'next/link';
import { Crown } from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { useProEntitlement } from '@/hooks/use-pro-entitlement';
import { formatBillingDate } from '@/lib/billing-api';
import { AccountNav, ResourceState, PageHead, membershipLabel, membershipDescription, SupportNote } from '@/components/pro/billing-ui';
import s from '@/components/pro/pro.module.css';

export default function MembershipPage() {
  const resource = useProEntitlement(), data = resource.data;
  return <SiteShell><div className={s.page}>
    <PageHead title="我的会员" subtitle="查看当前方案、有效期与使用额度。"
      action={resource.state === 'ready' ? <button className={s.secondary} onClick={() => void resource.refresh()}>刷新</button> : undefined} />
    <AccountNav current="membership" />
    <ResourceState resource={resource} noun="会员信息" returnTo="/me/membership/">
      {data ? <>
        <section className={s.settingsSection}>
          <div className={s.sectionTitle}><h2>当前方案</h2></div>
          <div className={`${s.membershipSummary} ${s.membershipPanel}`}>
            <div><div className={s.membershipName}><strong>{data.state === 'free' ? '免费版' : '寻鹿 Pro'}</strong>
              {data.state !== 'free' ? <span className={s.badge}>{membershipLabel(data)}</span> : null}</div>
              <p>{membershipDescription(data)}</p></div>
            <div className={s.actions}><Crown className={s.memberCrown} size={42} strokeWidth={1} aria-hidden="true" /><Link className={s.secondary} href="/pro/#plans">查看方案</Link></div>
          </div>
        </section>
        <section className={s.settingsSection}>
          <div className={s.sectionTitle}><h2>使用额度</h2></div>
          <div className={s.usageRow}>
            <div><h3>申请项目</h3><p className={s.small}>{data.applications.overLimitRetained ? '已有项目全部保留，可继续管理。' : '用于跟进院校、材料与申请进度。'}</p></div>
            <div><div className={s.usageValue}>{data.applications.used}<small>{data.applications.limit === null ? '个 · 不限数量' : data.applications.overLimitRetained ? '个已保留 · 免费额度 ' + data.applications.limit + ' 个' : '个 / ' + data.applications.limit + ' 个'}</small></div>
              {data.applications.limit !== null && data.applications.limit > 0 ? <meter aria-label="申请项目额度使用情况" min={0} max={data.applications.limit} value={Math.min(data.applications.used, data.applications.limit)} /> : null}
              <p className={s.small}>{data.applications.canCreate ? data.applications.limit === null ? '当前可继续新增项目。' : '还可新增 ' + Math.max(0, data.applications.limit - data.applications.used) + ' 个项目。' : '新增额度已用完，无需删除已有项目。'}</p>
            </div>
            <Link className={s.quiet} href="/me/">管理项目 <span aria-hidden="true">↗</span></Link>
          </div>
          <details className={s.disclosure}><summary>查看资料传入记录</summary>
            <p>本月已传入 {data.fillTransfers.used} 次，{data.fillTransfers.limit === null ? '当前额度不限' : '额度 ' + data.fillTransfers.limit + ' 次'}。{formatBillingDate(data.fillTransfers.resetsAt)} 更新（北京时间）。</p>
            <p>网站与助手的连接尚未开放，此处仅供查询已有记录。<Link href="/guide/fill-assistant/">查看助手指南</Link></p>
          </details>
        </section>
        <section className={s.settingsSection}><div className={s.membershipSummary}>
          <div><h2>订单与售后</h2><p>查询付款记录、开通进度或退款状态。</p></div>
          <Link className={s.quiet} href="/me/orders/">查看订单记录 <span aria-hidden="true">→</span></Link>
        </div></section>
      </> : null}
    </ResourceState>
    <footer className={s.supportFooter}><SupportNote /><Link className={s.quiet} href="/pro/service/">服务说明</Link></footer>
  </div></SiteShell>;
}
