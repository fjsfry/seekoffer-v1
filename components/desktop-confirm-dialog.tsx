'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

type DesktopConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  returnFocusTo?: HTMLElement | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DesktopConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = '取消',
  busy = false,
  returnFocusTo,
  onCancel,
  onConfirm
}: DesktopConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  onCancelRef.current = onCancel;
  busyRef.current = busy;

  useEffect(() => {
    const desktopSurface = document.documentElement.classList.contains('seekoffer-desktop-surface');
    const reduceMotion =
      document.documentElement.dataset.desktopReduceMotion === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (open) {
      setMounted(true);
      if (reduceMotion) {
        setVisible(true);
        return;
      }
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    if (!desktopSurface || reduceMotion) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;

    const overlay = overlayRef.current;
    const backgroundStates = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlay)
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden')
      }));
    for (const state of backgroundStates) {
      state.element.inert = true;
      state.element.setAttribute('aria-hidden', 'true');
    }

    restoreFocusRef.current =
      returnFocusTo || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const focusFrame = window.requestAnimationFrame(() => cancelButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      for (const state of backgroundStates) {
        state.element.inert = state.inert;
        if (state.ariaHidden === null) state.element.removeAttribute('aria-hidden');
        else state.element.setAttribute('aria-hidden', state.ariaHidden);
      }
      const target = restoreFocusRef.current;
      window.requestAnimationFrame(() => {
        if (target?.isConnected) {
          target.focus({ preventScroll: true });
          return;
        }

        document
          .querySelector<HTMLElement>('[data-desktop-view-search], #main-content, main')
          ?.focus({ preventScroll: true });
      });
    };
  }, [mounted, returnFocusTo]);

  if (!mounted) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      if (busyRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      onCancelRef.current();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || []
    );
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="desktop-global-dialog-backdrop fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/30 p-6 backdrop-blur-[2px]"
      data-state={visible ? 'open' : 'closed'}
      aria-hidden={visible ? undefined : true}
      onMouseDown={(event) => {
        if (visible && event.target === event.currentTarget && !busy) onCancel();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-state={visible ? 'open' : 'closed'}
        className="desktop-global-dialog-panel w-full max-w-[440px] rounded-[22px] border border-slate-200/90 bg-white p-6 text-left shadow-[0_28px_80px_rgba(15,38,35,0.26)]"
      >
        <div className="flex items-start gap-4">
          <span className="desktop-global-dialog-icon desktop-global-dialog-icon--danger inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[17px] font-semibold leading-6 text-slate-900">
              {title}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭确认窗口"
            disabled={busy}
            onClick={onCancel}
            className="desktop-global-dialog-close inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="desktop-global-dialog-secondary inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="desktop-global-dialog-primary desktop-global-dialog-primary--danger inline-flex min-h-10 min-w-[96px] items-center justify-center rounded-lg bg-rose-700 px-4 text-sm font-semibold text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? '正在处理…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
