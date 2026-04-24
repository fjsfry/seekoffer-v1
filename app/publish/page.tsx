'use client';

import Link from 'next/link';
import { ArrowRight, PencilLine } from 'lucide-react';
import { LoginRequiredCard } from '@/components/login-required-card';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { useUserSessionState } from '@/hooks/use-user-session';
import { isMemberSession } from '@/lib/user-session';

export default function PublishPage() {
  const { ready, loggedIn, session } = useUserSessionState();
  const canPublish = isMemberSession(session);

  if (!ready) {
    return (
      <SiteShell>
        <PageSectionTitle
          eyebrow="Share Offer"
          title="发布 Offer 动态"
          subtitle="真实 Offer 发布会影响候补判断，因此需要登录、审核和后续举报机制。"
        />
        <LoginRequiredCard
          title="发布动态前需要先登录"
          description="为了减少虚假信息，发布 Offer 动态会记录账号状态；正式通道开放后会支持匿名展示、审核和举报。"
          requiredAuth="member"
          actionLabel="登录后继续"
          intent={{
            type: 'publish-offer',
            returnTo: '/publish',
            reason: 'publish-gate',
            requiredAuth: 'member'
          }}
        />
      </SiteShell>
    );
  }

  if (!loggedIn || !canPublish) {
    return (
      <SiteShell>
        <PageSectionTitle
          eyebrow="Share Offer"
          title="发布 Offer 动态"
          subtitle="分享你的保研去向与释放的 Offer，帮助候补池中的同学更快预判机会变化。"
        />
        <LoginRequiredCard
          title={loggedIn ? '试用态还不能直接发布 Offer' : '发布动态前需要先登录'}
          description={
            loggedIn
              ? '试用模式可以先体验通知库和基础工作台，但发布 Offer 会影响社区可信度，所以需要升级到正式账号登录后再继续。'
              : '登录后即可发布 Offer 动态、管理个人申请记录，并在后续开放实名认证时优先完成身份升级。'
          }
          requiredAuth="member"
          actionLabel={loggedIn ? '升级正式账号后继续' : '登录后继续'}
          intent={{
            type: 'publish-offer',
            returnTo: '/publish',
            reason: 'publish-gate',
            requiredAuth: 'member'
          }}
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Share Offer"
        title="发布 Offer 动态"
        subtitle="分享你的保研去向与释放的 Offer，帮助候补池中的同学更快预判机会变化。"
      />

      <section className="rounded-[30px] border border-black/5 bg-white p-10 text-center shadow-soft">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-cream text-brand">
          <PencilLine className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-ink">发布通道即将开放</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
          为了保证社区信息真实、清晰且可追溯，发布系统正在接入校园实名认证与基础审核能力，敬请期待。
        </p>
        <Link href="/offers" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand">
          先去浏览 Offer 池
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </SiteShell>
  );
}
