'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, LoaderCircle, LogIn, LogOut } from 'lucide-react';
import {
  getUserSession,
  hydrateCloudbaseSession,
  openCloudbaseLoginPage,
  signOutUser,
  watchUserSession,
  type UserSession
} from '@/lib/user-session';

export function UserSessionEntry() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [pendingAction, setPendingAction] = useState<'login' | 'logout' | ''>('');

  useEffect(() => {
    const load = async () => {
      setSession(getUserSession());
      await hydrateCloudbaseSession();
      setSession(getUserSession());
    };

    void load();
    const dispose = watchUserSession(() => {
      setSession(getUserSession());
    });
    return () => dispose();
  }, []);

  async function handleOpenLogin() {
    if (pendingAction) {
      return;
    }

    setPendingAction('login');

    try {
      await openCloudbaseLoginPage();
    } finally {
      setPendingAction('');
    }
  }

  async function handleSignOut() {
    if (pendingAction) {
      return;
    }

    setPendingAction('logout');

    try {
      await signOutUser();
      setSession(null);
    } finally {
      setPendingAction('');
    }
  }

  if (!session) {
    return (
      <button
        onClick={handleOpenLogin}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5"
      >
        {pendingAction === 'login' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        登录
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
      <Link
        href="/me"
        className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
          <LayoutGrid className="h-4 w-4" />
        </span>
        <span>工作台</span>
      </Link>
      <button
        onClick={handleSignOut}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/18"
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
