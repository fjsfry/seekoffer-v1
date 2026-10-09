'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown, ChevronRight, CircleAlert, Crown, Mail, ShieldCheck } from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { useProCatalog } from '@/hooks/use-pro-catalog';
import { useProEntitlement } from '@/hooks/use-pro-entitlement';
import { formatPlanPrice } from '@/lib/billing-api';
import { AccountNav, membershipLabel, openBillingLogin } from '@/components/pro/billing-ui';
import { ProHero, ProFooter } from '@/components/pro/purchase-surfaces';
import s from '@/components/pro/pro.module.css';
import p from '@/components/pro/purchase-page.module.css';

const faqs = [
  ['会自动续费吗？', '不会。每次开通均为一次性购买，到期后由你决定是否延长。'],
  ['到期后，已有资料会消失吗？', '已有项目和资料继续保留，可以查看和管理。超出免费新增额度时暂停新增，不要求删除已有项目。'],
  ['付款后还没开通怎么办？', '在“订单记录”查看进度。付款确认和会员开通可能有时间差，请勿重复付款，可携订单号联系支持。']
];

function ProContent() {
  const catalog = useProCatalog(), member = useProEntitlement();
  const query = useSearchParams(), router = useRouter();
  const plans = catalog.data?.plans ?? [], requested = query.get('plan');
  const selected = plans.find(plan => plan.id === requested)
    ?? (requested ? null : plans.find(plan => plan.is_recommended) ?? plans[0]);
  const paused = catalog.data?.saleState !== 'available';
  const purchaseDisabled = paused || !selected || member.state === 'loading' || member.state === 'error';
  const catalogReady = catalog.state === 'ready';

  function continuePurchase() {
    if (purchaseDisabled || !selected) return;
    const href = '/checkout/?plan=' + encodeURIComponent(selected.id);
    if (member.state === 'guest') openBillingLogin(href);
    else router.push(href);
  }

  return <div className={`${s.page} ${p.page}`}>
    <ProHero />
    <div className={p.accountBar}><AccountNav current="plans" /></div>
    <div className={p.purchaseGrid} id="plans">
      <section className={p.planPanel} aria-labelledby="plans-title">
        <div className={p.sectionHead}>
          <h2 id="plans-title">选择适合你的申请周期</h2>
          <p>所有方案均包含完整 Pro 权益，按你的申请节奏选择。</p>
        </div>
        {catalog.state === 'loading' ? <div className={p.catalogState} role="status">正在读取方案价格…</div>
          : catalog.state === 'error' ? <div className={p.catalogState} role="status"><CircleAlert size={24} aria-hidden="true" /><p>暂时无法读取方案，请稍后重试。</p><button className={s.secondary} onClick={() => void catalog.refresh()}>重新读取</button></div>
          : !plans.length ? <div className={p.catalogState}>暂无可展示的方案，你仍可使用现有功能。</div>
          : <fieldset className={p.plans}>
            <legend className="sr-only">选择 Pro 套餐</legend>
            {plans.map(plan => <label className={p.plan} key={plan.id}>
              <div className={p.planTop}>
                <h3>{plan.name}</h3>
                <input type="radio" name="pro-plan" value={plan.id}
                  checked={selected?.id === plan.id}
                  onChange={() => router.replace('/pro/?plan=' + encodeURIComponent(plan.id) + '#plans', { scroll: false })}
                  aria-label={plan.name + ' ' + formatPlanPrice(plan.price_cents) + ' ' + plan.duration_days + '天'} />
              </div>
              <div className={p.price}>{formatPlanPrice(plan.price_cents)}</div>
              <p className={p.duration}>{plan.duration_days} 天有效期</p>
              <span className={p.planCaption}>{plan.id === 'pro_monthly' ? '短期集中申请' : plan.id === 'pro_quarter' ? '覆盖阶段性申请' : '适合长期准备'}</span>
            </label>)}
          </fieldset>}
        <div className={p.includedBenefits}>
          <p><Crown size={19} aria-hidden="true" /><strong>申请项目，不限数量</strong></p>
          <ul aria-label="方案说明"><li><Check size={15} aria-hidden="true" />材料与进度集中管理</li><li><Check size={15} aria-hidden="true" />到期后已有资料保留</li></ul>
        </div>
        <details className={p.comparisonDisclosure}>
          <summary>查看免费版与 Pro 的区别<ChevronDown size={17} aria-hidden="true" /></summary>
          <div className={p.comparison}>
            <table className={p.table}><caption className="sr-only">免费版与 Pro 权益对比</caption><thead><tr><th scope="col">功能</th><th scope="col">免费版</th><th scope="col">Pro</th></tr></thead><tbody>
              <tr><th scope="row">新增申请项目额度</th><td>{catalog.data ? '最多 ' + catalog.data.freeLimit + ' 个' : '暂不可确认'}</td><td>不限数量</td></tr>
              <tr><th scope="row">材料与进度管理</th><td>包含</td><td>包含</td></tr>
              <tr><th scope="row">已有项目与资料</th><td>保留并可管理</td><td>保留并可管理</td></tr>
            </tbody></table>
          </div>
        </details>
      </section>
      <aside className={p.summaryPanel} aria-labelledby="summary-title">
        <div className={p.summaryOverview}>
          <h2 id="summary-title">方案摘要</h2>
          <div className={p.summaryDetails} aria-live="polite" aria-atomic="true">
            <div className={p.summaryPlan}><span><Crown size={18} aria-hidden="true" />{selected?.name ?? (catalogReady ? '请选择方案' : '方案信息待确认')}</span><span>{selected ? selected.duration_days + ' 天' : '—'}</span></div>
            <div className={p.summaryTotal}><span>方案金额</span><strong>{selected ? '¥' + (selected.price_cents / 100).toFixed(2) : '—'}</strong></div>
            <p className={p.renewalNote}><ShieldCheck size={15} aria-hidden="true" />一次性购买 · 不自动续费</p>
          </div>
          <div className={p.accountStatus} id="account-benefits" aria-live="polite">
            {member.state === 'loading' ? <p>正在确认会员状态…</p>
              : member.state === 'error' ? <p>会员状态暂不可确认。<button className={s.quiet} onClick={() => void member.refresh()}>重试</button></p>
              : member.data ? <span className={s.badge}>当前：{membershipLabel(member.data)}</span> : null}
          </div>
        </div>
        <div className={p.summaryAction}>
          <div className={p.purchaseState} role="status">
            <CircleAlert size={21} aria-hidden="true" />
            <div><strong>{!catalogReady ? '方案信息暂不可确认' : !plans.length ? '暂无可购买方案' : paused ? '当前暂停购买' : '一次性购买，按需开通'}</strong>
            <p>{!catalogReady ? '请在方案读取完成后继续。' : paused || !plans.length ? '已有功能和资料仍可正常使用。' : '确认方案后，前往订单页核对并付款。'}</p></div>
          </div>
          <button className={p.purchaseButton} disabled={purchaseDisabled} onClick={continuePurchase}>
            {!catalogReady ? '等待方案确认' : !plans.length ? '暂无可购买方案' : paused ? '暂时无法购买' : !selected ? '请选择方案' : member.state === 'guest' ? '登录并继续' : member.data?.state === 'active' ? '延长有效期' : '继续'}
          </button>
          <div className={p.summaryLinks}><Link href="/pro/service/">服务说明<ChevronRight size={15} aria-hidden="true" /></Link><Link href="/me/orders/">订单帮助<ChevronRight size={15} aria-hidden="true" /></Link></div>
        </div>
      </aside>
    </div>
    <section className={p.faqSection} aria-labelledby="faq-title" id="account-support">
      <div className={p.faqHeading}><div><h2 id="faq-title">开通前，你可能想了解</h2><p>关于有效期、资料与订单的解答。</p></div><a className={p.supportLink} href="mailto:seekoffer@qq.com"><Mail size={17} aria-hidden="true" />联系支持</a></div>
      <div className={p.faq}>
        {faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </div><Link className={p.guideLink} id="install-extension" href="/guide/fill-assistant/">了解 Pro 与填报助手的区别 <ChevronRight size={14} aria-hidden="true" /></Link>
    </section>
  </div>;
}

export default function ProPage() {
  return <SiteShell footer={<ProFooter />}><Suspense fallback={<div className={s.skeleton}>正在读取方案…</div>}><ProContent /></Suspense></SiteShell>;
}
