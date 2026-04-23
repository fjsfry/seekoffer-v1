'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MonitorSmartphone, ShieldCheck, X } from 'lucide-react';
import { LoginMethodPanel } from '@/components/login-method-panel';
import { type AuthIntent, watchAuthModal } from '@/lib/auth-intent';

function resolveModalCopy(intent: AuthIntent | null, isMobile: boolean) {
  if (intent?.type === 'add-project') {
    return {
      eyebrow: '加入申请表',
      title: '登录后把这条通知直接接到你的申请路径里',
      description: '完成登录后，我们会自动继续刚才的动作，不需要你重新回到通知库再点一次。'
    };
  }

  if (intent?.type === 'publish-offer') {
    return {
      eyebrow: '发布社区动作',
      title: isMobile ? '升级正式登录后继续发布 Offer' : '升级正式登录后继续你的发布与社区贡献动作',
      description: '试用态可以先体验通知库和基础工作台，但发布 Offer 会影响社区可信度，所以需要切换到正式账号后再继续。'
    };
  }

  if (intent?.type === 'open-workspace' && intent.requiredAuth === 'member') {
    return {
      eyebrow: '升级登录',
      title: '升级正式登录后继续你的关键动作',
      description: '试用态适合先熟悉 Seekoffer 的通知库和基础工作台；当你要发布、沉淀个人动作或继续更正式的流程时，可以直接在这里升级。'
    };
  }

  if (intent?.type === 'open-workspace') {
    return {
      eyebrow: '进入工作台',
      title: '登录后开启你的申请工作台',
      description: '登录后可以统一管理申请表、待办、提醒和个人资料，浏览中的内容也会继续接回。'
    };
  }

  return {
    eyebrow: 'Seekoffer 登录',
    title: isMobile ? '登录后继续你的申请准备' : '登录后把申请进度、待办和通知管理放到同一条路径里',
    description: '通知库、资源库和院校库可以先浏览；只有加入申请表、进入工作台这类关键动作才需要完成登录。'
  };
}

export function AuthModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<AuthIntent | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const dispose = watchAuthModal((nextIntent) => {
      setIntent(nextIntent);
      setOpen(true);
    });

    return () => dispose();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(media.matches);

    apply();
    media.addEventListener?.('change', apply);
    return () => media.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const copy = useMemo(() => resolveModalCopy(intent, isMobile), [intent, isMobile]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        aria-label="关闭登录弹层"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-md"
        onClick={() => setOpen(false)}
      />

      <div className="absolute inset-0 flex items-end justify-center p-0 sm:items-center sm:p-6">
        <section className="relative w-full max-w-[960px] overflow-hidden rounded-t-[28px] border border-white/60 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_40px_140px_rgba(15,76,92,0.22)] sm:rounded-[36px]">
          <div className="border-b border-black/5 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.12),transparent_42%),linear-gradient(180deg,#ffffff_0%,rgba(248,250,252,0.95)_100%)] px-5 py-5 sm:px-8 sm:py-7">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
                  {copy.eyebrow}
                </div>
                <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">
                  {copy.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{copy.description}</p>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
                <ShieldCheck className="h-4 w-4 text-brand" />
                登录成功后会自动继续你刚才的动作
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
                <MonitorSmartphone className="h-4 w-4 text-brand" />
                当前来源页：{pathname === '/me' ? '工作台' : pathname}
              </div>
            </div>
          </div>

          <div className="max-h-[min(82vh,920px)] overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.58)_0%,rgba(255,255,255,0.98)_18%,#ffffff_100%)] px-5 py-5 sm:px-8 sm:py-7">
            <LoginMethodPanel mode={isMobile ? 'popover' : 'modal'} onSuccess={() => setOpen(false)} />
          </div>
        </section>
      </div>
    </div>
  );
}
