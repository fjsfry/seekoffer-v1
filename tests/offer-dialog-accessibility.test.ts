import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveModalTabNavigation } from '@/hooks/use-accessible-modal';

const workspaceRoot = process.cwd();
const offersSource = fs.readFileSync(
  path.join(workspaceRoot, 'app', 'offers', 'page.tsx'),
  'utf8'
);
const modalHookSource = fs.readFileSync(
  path.join(workspaceRoot, 'hooks', 'use-accessible-modal.ts'),
  'utf8'
);

describe('Offer dialog keyboard behavior', () => {
  it('wraps forward Tab from the final control to the first control', () => {
    expect(
      resolveModalTabNavigation({ activeIndex: 4, focusableCount: 5, shiftKey: false })
    ).toEqual({ preventDefault: true, focusIndex: 0 });
  });

  it('wraps Shift+Tab from the first control to the final control', () => {
    expect(
      resolveModalTabNavigation({ activeIndex: 0, focusableCount: 5, shiftKey: true })
    ).toEqual({ preventDefault: true, focusIndex: 4 });
  });

  it('puts an escaped or missing focus back inside the modal', () => {
    expect(
      resolveModalTabNavigation({ activeIndex: -1, focusableCount: 3, shiftKey: false })
    ).toEqual({ preventDefault: true, focusIndex: 0 });
    expect(
      resolveModalTabNavigation({ activeIndex: -1, focusableCount: 3, shiftKey: true })
    ).toEqual({ preventDefault: true, focusIndex: 2 });
  });

  it('does not intercept ordinary movement between internal controls', () => {
    expect(
      resolveModalTabNavigation({ activeIndex: 2, focusableCount: 5, shiftKey: false })
    ).toEqual({ preventDefault: false, focusIndex: null });
    expect(
      resolveModalTabNavigation({ activeIndex: 2, focusableCount: 5, shiftKey: true })
    ).toEqual({ preventDefault: false, focusIndex: null });
  });

  it('keeps focus on the modal itself when it has no interactive controls', () => {
    expect(
      resolveModalTabNavigation({ activeIndex: -1, focusableCount: 0, shiftKey: false })
    ).toEqual({ preventDefault: true, focusIndex: null });
  });
});

describe('Offer dialog accessibility source contract', () => {
  it('uses one reusable focus, Escape and restoration behavior for both dialogs', () => {
    expect(offersSource.match(/useAccessibleModal\(/g)).toHaveLength(2);
    expect(modalHookSource).toContain("if (event.key === 'Escape')");
    expect(modalHookSource).toContain("if (event.key !== 'Tab') return");
    expect(modalHookSource).toContain('onCloseRef.current()');
    expect(modalHookSource).toContain('returnFocusRef.current =');
    expect(modalHookSource).toContain('target?.isConnected');
    expect(modalHookSource).toContain('target.focus({ preventScroll: true })');
  });

  it('renders both dialogs in a body portal and removes the background accessibility tree', () => {
    expect(offersSource.match(/return createPortal\(/g)).toHaveLength(2);
    expect(offersSource.match(/role="dialog"/g)).toHaveLength(2);
    expect(offersSource.match(/aria-modal="true"/g)).toHaveLength(2);
    expect(offersSource.match(/tabIndex=\{-1\}/g)).toHaveLength(2);
    expect(modalHookSource).toContain('document.body.children');
    expect(modalHookSource).toContain('state.element.inert = true');
    expect(modalHookSource).toContain("state.element.setAttribute('aria-hidden', 'true')");
    expect(modalHookSource).toContain('state.element.inert = state.inert');
    expect(modalHookSource).toContain("state.element.removeAttribute('aria-hidden')");
  });

  it('defines intentional initial focus and keeps the inline report form in the trap', () => {
    expect(offersSource.match(/data-modal-initial-focus/g)).toHaveLength(2);
    expect(offersSource).toContain('ref={reportReasonRef}');
    expect(offersSource).toContain('ref={reportTriggerRef}');
    expect(offersSource).toContain('aria-expanded={props.reportOpen}');
    expect(offersSource).toContain('aria-controls="offer-report-form"');
    expect(offersSource).toContain('reportReasonRef.current?.focus({ preventScroll: true })');
    expect(offersSource).toContain('reportTriggerRef.current?.focus({ preventScroll: true })');
  });

  it('keeps report, reply and discussion submissions on their existing business handlers', () => {
    expect(offersSource).toContain('onSubmit={props.onReport}');
    expect(offersSource).toContain('onSubmit={props.onReply}');
    expect(offersSource).toContain('onSubmit={onSubmit}');
    expect(offersSource).toContain('await reportOfferPost(');
    expect(offersSource).toContain('await submitOfferComment(');
    expect(offersSource).toContain('await submitOfferDiscussion(');
  });
});
