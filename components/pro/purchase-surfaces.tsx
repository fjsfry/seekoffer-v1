import Link from 'next/link';
import { Crown, Infinity as InfinityIcon, ShieldCheck, ShoppingCart } from 'lucide-react';
import { footerAbout, footerColumns } from '@/lib/site-content';
import p from './purchase-page.module.css';

export function ProHero() {
  return <section className={p.hero} aria-labelledby="pro-title">
    <div className={p.heroCopy}>
      <span className={p.eyebrow}><Crown size={23} fill="currentColor" strokeWidth={1.4} aria-hidden="true" />SEEKOffer PRO</span>
      <h1 id="pro-title">寻鹿 Pro</h1>
      <p>为更多目标留出空间，让材料与进度有条不紊。</p>
      <ul className={p.heroBenefits}>
        <li><InfinityIcon size={27} aria-hidden="true" />申请项目不限数量</li>
        <li><ShoppingCart size={24} aria-hidden="true" />一次性购买</li>
        <li><ShieldCheck size={25} aria-hidden="true" />已有资料持续保留</li>
      </ul>
    </div>
    <div className={p.heroArt} aria-hidden="true">
      <div className={p.cardHalo} />
      <div className={p.lightTrailBack} />
      <div className={p.glassPass}><span>MORE<br />POSSIBILITIES<br />A BRIGHTER<br />YOU</span></div>
      <div className={p.memberPass}>
        <span className={p.passBrand}>寻鹿 Seekoffer</span>
        <strong>Pro</strong>
        <Crown className={p.passCrown} strokeWidth={.8} />
        <span className={p.passTagline}>让每一步申请，都有条不紊</span>
      </div>
      <div className={p.lightTrailFront} />
      <span className={p.sparkOne} /><span className={p.sparkTwo} /><span className={p.sparkThree} />
    </div>
  </section>;
}

export function ProFooter() {
  return <footer className={p.footer}>
    <div className={p.footerBrand}><Link href="/">寻鹿 Seekoffer</Link><p>{footerAbout}</p><div><a href="mailto:seekoffer@qq.com">联系邮箱：seekoffer@qq.com</a><span>QQ 交流群：1092490793</span></div></div>
    <nav className={p.footerColumns} aria-label="页脚导航">
      {footerColumns.map(column => <div key={column.title}><h2>{column.title}</h2>{column.links.slice(0, 4).map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div>)}
    </nav>
    <div className={p.footerLegal}><div><Link href="/terms/">用户协议</Link><Link href="/privacy/">隐私政策</Link><Link href="/disclaimer/">免责声明</Link></div><p>© 2026 寻鹿 Seekoffer.<br />保研通知、申请管理与资源整合平台。</p></div>
  </footer>;
}
