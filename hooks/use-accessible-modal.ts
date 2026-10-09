'use client';

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useEffect,
  useRef
} from 'react';

export const MODAL_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export type ModalTabResolution = {
  preventDefault: boolean;
  focusIndex: number | null;
};

export function resolveModalTabNavigation({
  activeIndex,
  focusableCount,
  shiftKey
}: {
  activeIndex: number;
  focusableCount: number;
  shiftKey: boolean;
}): ModalTabResolution {
  if (focusableCount <= 0) {
    return { preventDefault: true, focusIndex: null };
  }

  if (shiftKey && activeIndex <= 0) {
    return { preventDefault: true, focusIndex: focusableCount - 1 };
  }

  if (!shiftKey && (activeIndex < 0 || activeIndex >= focusableCount - 1)) {
    return { preventDefault: true, focusIndex: 0 };
  }

  return { preventDefault: false, focusIndex: null };
}

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.closest('[inert]') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      window.getComputedStyle(element).visibility !== 'hidden'
  );
}

export function useAccessibleModal(onClose: () => void): {
  dialogRef: RefObject<HTMLDivElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  handleModalKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
} {
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const overlay = overlayRef.current;
    if (!dialog || !overlay) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const backgroundStates = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== overlay
      )
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden')
      }));

    for (const state of backgroundStates) {
      state.element.inert = true;
      state.element.setAttribute('aria-hidden', 'true');
    }

    // Modal surfaces animate from a hidden state. Waiting for the following
    // paint keeps the initial focus from being rejected while an ancestor is
    // still visibility:hidden, which otherwise leaves focus on <body>.
    let visibleFocusFrame = 0;
    const mountFocusFrame = window.requestAnimationFrame(() => {
      visibleFocusFrame = window.requestAnimationFrame(() => {
        const initialFocus =
          dialog.querySelector<HTMLElement>('[data-modal-initial-focus]') ||
          getFocusableElements(dialog)[0] ||
          dialog;
        initialFocus.focus({ preventScroll: true });
      });
    });

    return () => {
      window.cancelAnimationFrame(mountFocusFrame);
      if (visibleFocusFrame) window.cancelAnimationFrame(visibleFocusFrame);

      for (const state of backgroundStates) {
        state.element.inert = state.inert;
        if (state.ariaHidden === null) state.element.removeAttribute('aria-hidden');
        else state.element.setAttribute('aria-hidden', state.ariaHidden);
      }

      const target = returnFocusRef.current;
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
  }, []);

  function handleModalKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }

    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = getFocusableElements(dialog);
    const activeIndex = focusable.findIndex((element) => element === document.activeElement);
    const resolution = resolveModalTabNavigation({
      activeIndex,
      focusableCount: focusable.length,
      shiftKey: event.shiftKey
    });

    if (!resolution.preventDefault) return;

    event.preventDefault();
    if (resolution.focusIndex === null) {
      dialog.focus({ preventScroll: true });
      return;
    }

    focusable[resolution.focusIndex]?.focus({ preventScroll: true });
  }

  return { dialogRef, overlayRef, handleModalKeyDown };
}
