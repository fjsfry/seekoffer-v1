'use client';
import {Fragment,type ReactNode} from 'react';
import {useUserSessionState} from '@/hooks/use-user-session';
import {isD1Backend} from '@/lib/backend-mode';

export function AdminAccountBoundary({children}:{children:ReactNode}){
  const {ready,session}=useUserSessionState();
  if(isD1Backend()&&!ready)return <main className="min-h-screen bg-slate-50 p-8"><p role="status">正在核对后台登录账号…</p></main>;
  return <Fragment key={isD1Backend()?session?.userId||'signed-out':'legacy'}>{children}</Fragment>;
}
