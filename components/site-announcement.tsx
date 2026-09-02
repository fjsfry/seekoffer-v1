'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { watchAuthModal } from '@/lib/auth-intent';
import { DESKTOP_RELEASE } from '@/lib/desktop-download';
import { SITE_ANNOUNCEMENT } from '@/lib/site-announcement';

type AnnouncementState = 'checking' | 'open' | 'closed';

export function SiteAnnouncement() {
  const [state, setState] = useState<AnnouncementState>('checking');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const rememberDismissal = useCallback(() => {
    try {
      window.localStorage.setItem(SITE_ANNOUNCEMENT.storageKey, 'dismissed');
    } catch {
      // Closing still works for the current document when storage is unavailable.
    }
  }, []);

  const restorePageFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      const previous = previousFocusRef.current;
      if (previous && previous !== document.body && previous.isConnected) {
        previous.focus({ preventScroll: true });
        return;
      }

      document.getElementById('main-content')?.focus({ preventScroll: true });
    });
  }, []);

  const dismiss = useCallback(
    (restoreFocus = true) => {
      rememberDismissal();
      if (dialogRef.current?.open) {
        dialogRef.current.close();
      }
      setState('closed');

      if (restoreFocus) {
        restorePageFocus();
      }
    },
    [rememberDismissal, restorePageFocus]
  );

  useEffect(() => {
    const expired = Date.now() > Date.parse(SITE_ANNOUNCEMENT.expiresAt);
    const onDownloadPage = window.location.pathname.replace(/\/$/, '') === SITE_ANNOUNCEMENT.actionHref;
    let dismissed = false;

    try {
      dismissed = window.localStorage.getItem(SITE_ANNOUNCEMENT.storageKey) === 'dismissed';
    } catch {
      dismissed = false;
    }

    setState(expired || onDownloadPage || dismissed ? 'closed' : 'open');
  }, []);

  useEffect(() => {
    if (state !== 'open') {
      return undefined;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return undefined;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!dialog.open) {
      dialog.showModal();
    }

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [state]);

  useEffect(() => {
    return watchAuthModal(() => {
      if (dialogRef.current?.open) {
        dismiss(false);
      }
    });
  }, [dismiss]);

  if (state !== 'open') {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      data-site-announcement={SITE_ANNOUNCEMENT.id}
      aria-labelledby="site-announcement-title"
      aria-describedby="site-announcement-summary"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          dismiss();
        }
      }}
      className="site-announcement-dialog fixed inset-0 m-0 mt-auto max-h-[94dvh] w-full max-w-none overflow-hidden rounded-t-[26px] border border-slate-200 bg-white p-0 text-left text-slate-700 shadow-[0_28px_90px_rgba(8,30,34,0.24)] sm:m-auto sm:w-[calc(100%-3rem)] sm:max-w-[820px] sm:rounded-[28px]"
    >
      <div className="flex max-h-[94dvh] min-h-0 flex-col sm:max-h-[calc(100dvh-3rem)]">
        <button
          ref={closeButtonRef}
          type="button"
          autoFocus
          onClick={() => dismiss()}
          aria-label="关闭网站公告"
          className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full text-2xl font-light leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/12 sm:right-5 sm:top-5"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="min-h-0 flex-1 overscroll-contain overflow-x-hidden overflow-y-auto">
          <article className="mx-auto max-w-[690px] px-6 pb-9 pt-14 sm:px-12 sm:pb-12 sm:pt-11">
            <header>
              <p className="text-sm font-medium text-brand">{SITE_ANNOUNCEMENT.eyebrow}</p>
              <p className="mt-5 text-sm font-semibold text-slate-500">{SITE_ANNOUNCEMENT.milestone}</p>
              <h2
                id="site-announcement-title"
                className="mt-2 text-[2rem] font-semibold leading-[1.25] tracking-[-0.035em] text-ink sm:text-[2.5rem]"
              >
                {SITE_ANNOUNCEMENT.title}
              </h2>
              <p id="site-announcement-summary" className="sr-only">
                感谢超过一万位同学使用寻鹿，寻鹿 Windows 桌面端现已开放下载。
              </p>
            </header>

            <div className="mt-7 space-y-4 text-[15px] leading-8 text-slate-600 sm:text-base sm:leading-8">
              {SITE_ANNOUNCEMENT.letterParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <section className="my-8 border-y border-slate-200 py-7 sm:my-10 sm:py-9">
              <p className="text-sm font-medium text-brand">{SITE_ANNOUNCEMENT.productEyebrow}</p>
              <h3 className="mt-2 text-2xl font-semibold leading-snug tracking-[-0.025em] text-ink sm:text-[1.8rem]">
                {SITE_ANNOUNCEMENT.productTitle}
              </h3>
              <div className="mt-4 space-y-4 text-[15px] leading-8 text-slate-600 sm:text-base">
                {SITE_ANNOUNCEMENT.productParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <p className="mt-5 text-sm font-medium text-slate-500">
                Windows 10 / 11 · v{DESKTOP_RELEASE.version} · {DESKTOP_RELEASE.installerSize} · 免费下载
              </p>
            </section>

            <blockquote className="text-lg font-medium leading-8 text-ink sm:text-xl sm:leading-9">
              {SITE_ANNOUNCEMENT.closing}
            </blockquote>
            <p className="mt-5 text-sm text-slate-500">{SITE_ANNOUNCEMENT.signature}</p>
          </article>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-8 sm:py-5">
          <div className="flex w-full flex-col gap-2.5 sm:flex-row-reverse">
            <Link
              href={SITE_ANNOUNCEMENT.actionHref}
              onClick={() => dismiss(false)}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15"
            >
              {SITE_ANNOUNCEMENT.actionLabel}
            </Link>
            <button
              type="button"
              onClick={() => dismiss()}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/10"
            >
              {SITE_ANNOUNCEMENT.secondaryActionLabel}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
