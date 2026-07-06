'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { NoticeDetailView } from '@/components/notice-detail-view';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { fetchPublicNotices } from '@/lib/cloudbase-data';
import { sanitizeNoticeForPublicView } from '@/lib/notice-public-copy';
import { baseNoticeProjects } from '@/lib/notice-source';
import type { PublicNoticeProject } from '@/lib/mock-data';

function getSafeNoticeReturnHref(value: string | null) {
  if (!value) {
    return '/notices';
  }

  if (value.startsWith('/notices') && !value.startsWith('//') && !/[\r\n]/.test(value)) {
    return value;
  }

  return '/notices';
}

function NoticeDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';
  const returnHref = getSafeNoticeReturnHref(searchParams.get('returnTo'));
  const initialProject = useMemo(() => {
    const matchedProject = baseNoticeProjects.find((item) => item.id === id) || null;
    return matchedProject ? sanitizeNoticeForPublicView(matchedProject) : null;
  }, [id]);
  const [remoteState, setRemoteState] = useState<{
    id: string;
    project: PublicNoticeProject | null;
    message: string;
  }>({
    id: '',
    project: null,
    message: ''
  });

  const remoteReady = remoteState.id === id;
  const project = initialProject || (remoteReady ? remoteState.project : null);
  const loading = Boolean(id && !initialProject && !remoteReady);
  const message = remoteReady ? remoteState.message : '';

  useEffect(() => {
    if (!id || initialProject) {
      return;
    }

    let active = true;

    fetchPublicNotices()
      .then((rows) => {
        if (!active) {
          return;
        }

        const matchedProject = rows.find((item) => item.id === id) || null;
        setRemoteState({
          id,
          project: matchedProject ? sanitizeNoticeForPublicView(matchedProject) : null,
          message: matchedProject ? '' : '当前通知库没有找到这条记录，可能已合并、更新或下线。'
        });
      })
      .catch(() => {
        if (active) {
          setRemoteState({
            id,
            project: null,
            message: '通知详情加载失败，请返回通知库重新打开，或加入 QQ 群反馈。'
          });
        }
      });

    return () => {
      active = false;
    };
  }, [id, initialProject]);

  if (!id) {
    return (
      <DetailShell title="没有找到通知编号" subtitle="当前链接缺少通知编号，请返回通知库重新选择一条通知。">
        <EmptyDetailState href={returnHref} label="返回通知库" />
      </DetailShell>
    );
  }

  if (loading) {
    return (
      <DetailShell title="正在加载通知详情" subtitle="正在读取最新整理结果，请稍等。">
        <section className="surface-card rounded-[34px] p-8">
          <div className="flex flex-col items-center justify-center gap-5 text-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-brand" />
            <p className="max-w-xl text-sm leading-7 text-slate-600">
              如果这条通知刚刚更新，详情页可能需要几秒钟同步。
            </p>
          </div>
        </section>
      </DetailShell>
    );
  }

  if (!project) {
    return (
      <DetailShell title="通知详情暂不可用" subtitle={message || '这条通知暂时无法打开。'}>
        <EmptyDetailState href={returnHref} label="返回通知库" />
      </DetailShell>
    );
  }

  return (
    <SiteShell>
      <NoticeDetailView project={project} returnHref={returnHref} />
    </SiteShell>
  );
}

function DetailShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <SiteShell>
      <PageSectionTitle eyebrow="通知详情" title={title} subtitle={subtitle} level="h1" />
      {children}
    </SiteShell>
  );
}

function EmptyDetailState({ href, label }: { href: string; label: string }) {
  return (
    <section className="surface-card rounded-[34px] p-8">
      <div className="flex flex-col items-center justify-center gap-5 text-center">
        <p className="max-w-xl text-sm leading-7 text-slate-600">
          页面没有继续停留在异常状态。你可以先回到通知库重新选择，也可以加入 QQ 群告诉我们。
        </p>
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep"
        >
          {label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export default function NoticeDetailQueryPage() {
  return (
    <Suspense
      fallback={
        <SiteShell>
          <PageSectionTitle eyebrow="通知详情" title="正在打开通知详情" subtitle="正在准备详情页，请稍等。" level="h1" />
        </SiteShell>
      }
    >
      <NoticeDetailContent />
    </Suspense>
  );
}
