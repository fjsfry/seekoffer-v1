'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, LayoutGrid, LoaderCircle, LogIn, LogOut } from 'lucide-react';
import { openAuthModal, writeAuthIntent } from '@/lib/auth-intent';
import { useUserSessionState } from '@/hooks/use-user-session';
import { getAuthProviderLabel, signOutUser } from '@/lib/user-session';

export function UserSessionEntry() {
  const pathname = usePathname();
  const { ready, session } = useUserSessionState();
  const [pendingAction, setPendingAction] = useState<'logout' | ''>('');

  function handleOpenLogin() {
    const intent = {
      type: 'open-workspace' as const,
      returnTo: pathname,
      reason: 'workspace-entry',
      requiredAuth: 'session' as const
    };

    writeAuthIntent(intent);
    openAuthModal(intent);
  }

  function handleUpgrade() {
    const intent = {
      type: 'open-workspace' as const,
      returnTo: pathname,
      reason: 'upgrade-session',
      requiredAuth: 'member' as const
    };

    writeAuthIntent(intent);
    openAuthModal(intent);
  }

  async function handleSignOut() {
    if (pendingAction) {
      return;
    }

    setPendingAction('logout');

    try {
      await signOutUser();
    } finally {
      setPendingAction('');
    }
  }

  if (!ready) {
    return (
      <button
        onClick={handleOpenLogin}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-white px-3 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5 hover:bg-white/95 md:h-11 md:px-4"
      >
        <LogIn className="h-4 w-4" />
        登录
      </button>
    );
  }

  if (!session) {
    return (
      <button
        onClick={handleOpenLogin}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-white px-3 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5 hover:bg-white/95 md:h-11 md:px-4"
      >
        <LogIn className="h-4 w-4" />
        登录
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
      <Link
        href="/me"
        className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 pr-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/95 md:h-11 md:px-3 md:pr-4"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-brand md:h-8 md:w-8">
          <LayoutGrid className="h-4 w-4" />
        </span>
        <span className="flex items-center gap-2">
          <span>{session.profile.nickname ? `${session.profile.nickname}的工作台` : '工作台'}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
            {getAuthProviderLabel(session.authProvider)}
          </span>
        </span>
      </Link>

      {session.authProvider === 'anonymous' ? (
        <button
          onClick={handleUpgrade}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5 hover:bg-white/95 md:h-11 md:px-4"
        >
          <ArrowUpRight className="h-4 w-4" />
          升级正式登录
        </button>
      ) : null}

      <button
        onClick={handleSignOut}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/12 transition hover:bg-white/18 md:h-11 md:w-11"
        aria-label="退出登录"
      >
        {pendingAction === 'logout' ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
