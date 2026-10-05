'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenText, RefreshCw } from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { readResourceOrder, readResourceOrderAccesses, type ResourceOrder } from '@/lib/resource-commerce-client';
import { formatCny } from '@/lib/resource-products';

type Purchase = { access: { orderNo: string; accessToken: string; savedAt: string }; order: ResourceOrder | null; error?: string };

export default function ResourcePurchasesPage() {
  const [items, setItems] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const accesses = readResourceOrderAccesses();
    const result = await Promise.all(accesses.map(async access => {
      try {
        return { access, order: await readResourceOrder(access.orderNo, access.accessToken) } satisfies Purchase;
      } catch {
        return { access, order: null, error: '暂时无法更新这笔订单，请稍后再试。' } satisfies Purchase;
      }
    }));
    setItems(result);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  return (
    <SiteShell>
      <section className="page-hero px-6 py-8 lg:px-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><span className="inline-flex items-center gap-2 rounded-full bg-brand/8 px-3 py-1.5 text-xs font-semibold text-brand"><BookOpenText className="h-4 w-4" />购买记录</span><h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">我的资源</h1><p className="mt-3 text-sm leading-7 text-slate-600">可以继续完成支付，或下载已经购买的数字资源。</p></div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 hover:text-brand"><RefreshCw className="h-4 w-4" />刷新</button>
        </div>
      </section>

      <section className="surface-card rounded-[34px] p-6 lg:p-8">
        {loading ? <div className="rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">正在加载购买记录…</div> : null}
        {!loading && !items.length ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-12 text-center"><p className="text-sm text-slate-500">当前浏览器还没有购买记录。</p><Link href="/resources" className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white">浏览资源库 <ArrowRight className="h-4 w-4" /></Link></div> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {items.map(item => item.order ? <article key={item.access.orderNo} className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-mono text-slate-400">{item.order.orderNo}</div><h2 className="mt-2 text-lg font-semibold text-ink">{item.order.title}</h2></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.order.status === 'fulfilled' ? 'bg-emerald-50 text-brand' : 'bg-amber-50 text-amber-700'}`}>{item.order.status === 'fulfilled' ? '已解锁' : item.order.payment?.status === 'pending' ? '待支付' : item.order.status}</span></div><div className="mt-5 flex items-center justify-between text-sm"><span className="text-slate-500">{formatCny(item.order.amountCents)}</span><Link href={`/resources/order-success?order=${encodeURIComponent(item.order.orderNo)}`} className="inline-flex items-center gap-1 font-semibold text-brand">打开订单 <ArrowRight className="h-4 w-4" /></Link></div></article> : <article key={item.access.orderNo} className="rounded-[26px] border border-amber-100 bg-amber-50/70 p-5"><div className="text-xs font-mono text-amber-700">{item.access.orderNo}</div><p className="mt-3 text-sm leading-6 text-amber-800">{item.error}</p><Link href={`/resources/order-success?order=${encodeURIComponent(item.access.orderNo)}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-900">继续查询 <ArrowRight className="h-4 w-4" /></Link></article>)}
        </div>
      </section>
    </SiteShell>
  );
}
