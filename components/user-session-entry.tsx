'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LoaderCircle, LogOut, QrCode, UserRound } from 'lucide-react';
import { LoginMethodPanel } from './login-method-panel';
import {
  getUserSession,
  hydrateCloudbaseSession,
  signOutUser,
  watchUserSession,
  type UserSession
} from '@/lib/user-session';

export function UserSessionEntry() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

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

  async function handleSignOut() {
    if (pending) {
      return;
    }

    setPending(true);

    try {
      await signOutUser();
      setSession(null);
    } finally {
      setPending(false);
    }
  }

  if (!session) {
    return (
      <div className="relative flex flex-col items-end gap-1.5">
        <button
          onClick={() => setOpen((current) => !current)}
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5"
        >
          <QrCode className="h-4 w-4" />
          登录 / 注册
        </button>
        {open ? (
          <div className="absolute right-0 top-full z-50 mt-3">
            <LoginMethodPanel
              mode="popover"
              onSuccess={() => {
                setOpen(false);
                setSession(getUserSession());
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
      <Link
        href="/me"
        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm"
      >
        <UserRound className="h-4 w-4 text-brand" />
        工作台
      </Link>
      <button
        onClick={handleSignOut}
        className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/18"
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        退出
      </button>
    </div>
  );
}
