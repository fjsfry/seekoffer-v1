'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { buildNoticeDetailHref } from '@/lib/notice-links';

function NoticeDetailRedirectContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';
  const targetHref = id ? buildNoticeDetailHref(id) : '/notices';

  useEffect(() => {
    if (!id) {
      return;
    }

    window.location.replace(targetHref);
  }, [id, targetHref]);

  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Notice Detail"
        title={id ? '正在打开通知详情' : '没有找到通知编号'}
        subtitle={
          id
            ? '我们已将详情页切换为静态直达链接，正在为你跳转到更稳定的通知详情页。'
            : '当前链接缺少通知编号，请返回通知库重新选择一条通知。'
        }
      />

      <section className="surface-card rounded-[34px] p-8">
        <div className="flex flex-col items-center justify-center gap-5 text-center">
          {id ? <LoaderCircle className="h-8 w-8 animate-spin text-brand" /> : null}
          <p className="max-w-xl text-sm leading-7 text-slate-600">
            {id
              ? '如果浏览器没有自动跳转，可以点击下面的按钮直接打开详情。'
              : '旧版详情链接需要携带 id 参数；新版通知库会直接打开静态详情页。'}
          </p>
          <Link
            href={targetHref}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep"
          >
            {id ? '打开通知详情' : '返回通知库'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}

export default function NoticeDetailQueryPage() {
  return (
    <Suspense
      fallback={
        <SiteShell>
          <PageSectionTitle eyebrow="Notice Detail" title="正在打开通知详情" subtitle="正在准备详情页，请稍等。" />
        </SiteShell>
      }
    >
      <NoticeDetailRedirectContent />
    </Suspense>
  );
}
