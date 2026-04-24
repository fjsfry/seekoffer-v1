'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
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
      <button aria-label="关闭登录弹层" className="absolute inset-0 bg-brand/18 backdrop-blur-lg" onClick={() => setOpen(false)} />

      <div className="absolute inset-0 flex items-end justify-center p-0 sm:items-center sm:p-6">
        <section className="relative w-full max-w-[1040px] overflow-hidden rounded-t-[28px] border border-white/70 bg-white shadow-[0_34px_120px_rgba(18,32,38,0.22)] sm:rounded-[28px]">
          <div className="bg-white px-6 py-6 sm:px-10 sm:py-9">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="text-sm font-semibold text-brand">{copy.eyebrow}</div>
                <h2 className="mt-3 text-[26px] font-semibold leading-tight text-ink sm:text-[32px]">
                  {copy.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{copy.description}</p>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                aria-label="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="max-h-[min(80vh,760px)] overflow-y-auto px-4 pb-5 sm:px-10 sm:pb-10">
            <LoginMethodPanel mode={isMobile ? 'popover' : 'modal'} onSuccess={() => setOpen(false)} />
          </div>
        </section>
      </div>
    </div>
  );
}
