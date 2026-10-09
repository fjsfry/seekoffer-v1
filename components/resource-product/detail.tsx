'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Check, ChevronRight, Mail } from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { SiteFooter } from '@/components/site-footer';
import { ProductGallery } from './gallery';
import { readResourceProduct, type ResourceProduct } from '@/lib/resource-commerce-client';
import { formatCny, resourceProductSeed } from '@/lib/resource-products';
import { kitMainImages, kitDetailImages, kitModules } from '@/lib/resource-product-media';
import s from './product.module.css';

const ProductCheckout = dynamic(() => import('./checkout'));
const ImageViewer = dynamic(() => import('./image-viewer'));
const sections = [{ id: 'product-details', label: '商品详情' }, { id: 'product-contents', label: '资料清单' }, { id: 'product-guide', label: '购买须知' }];
const faq = [
  ['购买后在哪里获取资料？', '支付确认后，订单交付页会提供百度网盘入口。你也可以从“购买记录”返回订单，继续获取资料。请保留订单编号。'],
  ['资料可以编辑和打印吗？', '资料包包含 Word 与 PPT 格式的模板，可根据实际经历替换文字、调整版式，并按申请要求导出或打印。使用兼容的办公软件打开即可。'],
  ['这是实物商品或定制服务吗？', '这是电子资料包，不邮寄实物，不包含代写或一对一定制。模板用于参考结构和表达，需要结合你的真实经历修改。'],
  ['证明材料可以直接提交吗？', '证明模板仅供整理信息和准备申请使用。正式在读证明、成绩及排名证明，应按所在学校要求由相应部门审核并出具。'],
  ['订单、资料或售后问题如何处理？', '请保存订单编号，通过 seekoffer@qq.com 联系支持。支付结果未确认时，请先查看订单状态，避免重复付款；售后按实际订单和站内服务说明处理。']
];

export function ResourceProductDetail({ slug }: { slug: string }) {
  const seed = resourceProductSeed(slug);
  const [product, setProduct] = useState<ResourceProduct>(() => ({
    id: seed.slug, slug: seed.slug, title: seed.title, summary: seed.summary, description: seed.description,
    coverUrl: null, amountCents: seed.amountCents, currency: 'CNY', version: 1, features: seed.features, files: [], fileCount: 0
  }));
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogNotice, setCatalogNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutMounted, setCheckoutMounted] = useState(false);
  const [detailPreview, setDetailPreview] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState('product-details');
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const purchaseTrigger = useRef<HTMLElement | null>(null);
  const imageTrigger = useRef<HTMLElement | null>(null);
  const detailsPanel = useRef<HTMLDivElement>(null);
  const shouldScrollToPanel = useRef(false);
  const pricePending = seed.priceStatus === 'pending';
  const canPurchase = !catalogLoading && !catalogNotice && !pricePending;
  const priceLabel = catalogLoading || catalogNotice ? '—' : pricePending ? '即将上线' : formatCny(product.amountCents);

  useEffect(() => { setPortalTarget(document.body); }, []);

  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    void readResourceProduct(slug).then(result => {
      if (active) { setProduct(result.product); setCatalogNotice(''); }
    }).catch(() => {
      if (active) setCatalogNotice('商品价格暂时无法确认，请重新读取后继续。');
    }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [slug, revision]);

  useEffect(() => {
    const readHash = () => {
      const id = window.location.hash.slice(1);
      if (sections.some(section => section.id === id)) setActiveSection(id);
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  useEffect(() => {
    if (!shouldScrollToPanel.current) return;
    shouldScrollToPanel.current = false;
    detailsPanel.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [activeSection]);

  function selectSection(id: string) {
    if (activeSection !== id) {
      shouldScrollToPanel.current = true;
      setActiveSection(id);
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#' + id);
  }

  const openCheckout = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    purchaseTrigger.current = event.currentTarget;
    setCheckoutMounted(true);
    setCheckoutOpen(true);
  }, []);
  const buyLabel = pricePending ? '即将上线' : catalogLoading ? '正在确认价格…' : catalogNotice ? '等待价格确认' : '立即购买';

  return <SiteShell footer={<div className={s.footerSpacing}><SiteFooter /></div>}>
    <div className={s.page}>
      <nav className={s.breadcrumbs} aria-label="面包屑">
        <div><Link href="/resources/">资源库</Link><ChevronRight size={12} /><span>寻鹿保研资料包</span></div>
        <Link href="/resources/purchases/">购买记录</Link>
      </nav>

      <section className={s.hero} aria-labelledby="product-title">
        <ProductGallery images={kitMainImages} />
        <div className={s.productInfo}>
          <h1 className={s.title} id="product-title"><span>电子资料</span>{product.title}</h1>
          <p className={s.subtitle}>个人陈述、简历、导师邮件、推荐信、英文自我介绍、PPT、证明材料</p>
          <div className={s.priceBox}>
            <span className={s.fieldLabel}>价格</span>
            <div><strong className={s.price} aria-live="polite">{priceLabel}</strong><span className={s.priceNote}>一次性购买</span></div>
          </div>
          <dl className={s.specs}>
            <div className={s.editionRow}><dt>商品版本</dt><dd><div className={s.edition}>
              <Image src="/resources/application-kit/main-01-thumb.webp" alt="" width={38} height={38} />
              <span>完整资料包 · 电子版</span><Check size={15} aria-hidden="true" />
            </div></dd></div>
            <div><dt>包含内容</dt><dd>7 类资料，27 份模板与材料 + 3 份使用说明</dd></div>
            <div><dt>文件格式</dt><dd>Word / PPT，支持编辑和打印</dd></div>
            <div><dt>交付方式</dt><dd>百度网盘 · 付款确认后在订单页获取</dd></div>
            <div><dt>适用阶段</dt><dd>夏令营、预推免、正式推免</dd></div>
          </dl>
          <div className={s.ctaRow}>
            <button className={s.buyButton} type="button" disabled={!canPurchase} onClick={openCheckout}>{buyLabel}</button>
            <a className={s.contactButton} href="mailto:seekoffer@qq.com"><Mail size={17} />咨询客服</a>
          </div>
          <div className={s.purchaseNote}>电子资料，无实物寄送。<Link href="/resources/purchases/">查看已购订单</Link></div>
          {catalogNotice ? <p className={s.catalogError} role="status">{catalogNotice}<button onClick={() => setRevision(value => value + 1)}>重新读取</button></p> : null}
        </div>
      </section>

      <div ref={detailsPanel} className={s.detailsPanel}>
        <div className={s.detailNav}>
          <div className={s.tabs} role="tablist" aria-label="商品信息" onKeyDown={event => {
            const current = sections.findIndex(section => section.id === activeSection);
            const next = event.key === 'ArrowRight' ? (current + 1) % sections.length
              : event.key === 'ArrowLeft' ? (current + sections.length - 1) % sections.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : -1;
            if (next < 0) return;
            event.preventDefault();
            selectSection(sections[next].id);
            document.getElementById('tab-' + sections[next].id)?.focus();
          }}>
            {sections.map(section => <button key={section.id} type="button" role="tab"
              id={'tab-' + section.id} aria-controls={section.id}
              aria-selected={activeSection === section.id} tabIndex={activeSection === section.id ? 0 : -1}
              onClick={() => selectSection(section.id)}>{section.label}</button>)}
          </div>
          <div className={s.navPurchase}><strong>{priceLabel}</strong><button className={s.buyButton} disabled={!canPurchase} onClick={openCheckout}>立即购买</button></div>
        </div>

        <section id="product-details" role="tabpanel" aria-labelledby="tab-product-details" hidden={activeSection !== 'product-details'} className={s.detailSection}>
          <dl className={s.productParameters}>
            <div><dt>商品名称</dt><dd>寻鹿保研资料包</dd></div>
            <div><dt>资料类型</dt><dd>保研申请模板与材料</dd></div>
            <div><dt>资料数量</dt><dd>27 份模板与材料 + 3 份说明</dd></div>
            <div><dt>文件格式</dt><dd>Word / PPT</dd></div>
            <div><dt>获取方式</dt><dd>订单页获取网盘链接</dd></div>
            <div><dt>使用说明</dt><dd>按个人经历修改后使用</dd></div>
          </dl>
          <div className={s.detailImageNote}>商品图文介绍<span>点击图片可放大查看</span></div>
          <div className={s.posters}>
            {kitDetailImages.map((image, index) => <figure className={s.poster} key={image.id}>
              <button type="button" aria-label={'查看详情大图：' + image.label} onClick={event => { imageTrigger.current = event.currentTarget; setDetailPreview(index); }}>
                <Image src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" sizes="(max-width: 767px) 100vw, 790px" />
              </button>
            </figure>)}
          </div>
        </section>

        <section id="product-contents" role="tabpanel" aria-labelledby="tab-product-contents" hidden={activeSection !== 'product-contents'} className={s.contentSection}>
          <h2>资料清单</h2><p className={s.panelSummary}>共 7 类资料，包含 27 份模板与材料，另附 3 份使用说明。</p>
          <table className={s.moduleTable}><caption className="sr-only">保研资料包的七类模板与数量</caption>
            <thead><tr><th scope="col">材料类型</th><th scope="col">数量</th><th scope="col">内容与场景</th><th scope="col">格式</th></tr></thead>
            <tbody>{kitModules.map(module => <tr key={module.name}><td>{module.name}</td><td>{module.count} {module.unit}</td><td>{module.description}</td><td>{module.format}</td></tr>)}</tbody>
          </table>
          <div className={s.bonusNote}><strong>附带说明</strong><p>联系导师注意事项、推荐信注意事项、版权与使用说明。</p></div>
        </section>

        <section id="product-guide" role="tabpanel" aria-labelledby="tab-product-guide" hidden={activeSection !== 'product-guide'} className={s.guideSection}>
          <h2>购买须知</h2>
          <dl className={s.faq}>{faq.map(([question, answer]) => <div key={question}><dt>{question}</dt><dd>{answer}</dd></div>)}</dl>
          <div className={s.supportLine}><span>订单或资料问题</span><a href="mailto:seekoffer@qq.com">seekoffer@qq.com</a><span>联系时请提供订单编号。</span></div>
        </section>
      </div>
      {portalTarget ? createPortal(<div className={s.mobilePurchase}><div><small>电子资料包</small><strong>{priceLabel}</strong></div><button className={s.buyButton} disabled={!canPurchase} onClick={openCheckout}>立即购买</button></div>, portalTarget) : null}
      {checkoutMounted ? <ProductCheckout product={product} catalogLoading={catalogLoading} catalogNotice={catalogNotice} pricePending={pricePending} open={checkoutOpen} onOpenChange={setCheckoutOpen} returnFocus={purchaseTrigger.current} /> : null}
      {detailPreview !== null ? <ImageViewer images={kitDetailImages} initialIndex={detailPreview} open onOpenChange={open => { if (!open) setDetailPreview(null); }} returnFocus={imageTrigger.current} /> : null}
    </div>
  </SiteShell>;
}
