import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDesktopUpdateCheckFeedback, restoreDesktopUpdateFocus } from '@/components/desktop-update-provider';
import { normalizeDesktopUpdaterSnapshot } from '@/lib/desktop-updater';

const root = process.cwd();
const stylesheet = postcss.parse(readFileSync(resolve(root, 'components/desktop-update-provider.module.css'), 'utf8'));

function declarations(selector: string) {
  const result = new Map<string, string>();
  stylesheet.walkRules((rule) => {
    if (rule.parent?.type !== 'root' || rule.selector !== selector) return;
    rule.walkDecls((declaration) => { result.set(declaration.prop, declaration.value); });
  });
  return result;
}

describe('standalone desktop updater notice layout', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('restores focus only after a closing modal releases trigger visibility', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('window', { requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback), cancelAnimationFrame: vi.fn() });
    let visible = false;
    vi.stubGlobal('getComputedStyle', () => ({ visibility: visible ? 'visible' : 'hidden' }));
    const focus = vi.fn();
    const target = { isConnected: true, closest: () => null, getClientRects: () => [{}], focus } as unknown as HTMLElement;
    restoreDesktopUpdateFocus(target);
    frames.shift()?.(0);
    expect(focus).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    visible = true;
    frames.shift()?.(16);
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(frames).toHaveLength(0);
  });

  it('cancels a pending focus restoration when another modal takes ownership', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('window', { requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback), cancelAnimationFrame: vi.fn() });
    vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible' }));
    const focus = vi.fn();
    const target = { isConnected: true, closest: () => null, getClientRects: () => [{}], focus } as unknown as HTMLElement;
    const cancel = restoreDesktopUpdateFocus(target);
    cancel();
    frames.shift()?.(0);
    expect(focus).not.toHaveBeenCalled();
  });

  it('emits no duplicate success feedback for available and downloaded updates', () => {
    for (const phase of ['available', 'readyToInstall']) {
      const snapshot = normalizeDesktopUpdaterSnapshot({ currentVersion: '0.2.28', version: '0.2.29', phase });
      expect(getDesktopUpdateCheckFeedback(snapshot)).toBeNull();
    }
  });

  it('still confirms an up-to-date manual check and explains failed checks', () => {
    const current = normalizeDesktopUpdaterSnapshot({ currentVersion: '0.2.28', phase: 'upToDate' });
    expect(getDesktopUpdateCheckFeedback(current)).toEqual({ message: '当前已是最新版本', tone: 'success' });
    const failed = normalizeDesktopUpdaterSnapshot({ phase: 'error', errorCode: 'UPDATE_NETWORK_ERROR', errorMessage: '检查连接失败', retryable: true });
    const feedback = getDesktopUpdateCheckFeedback(failed);
    expect(feedback?.tone).toBe('warning');
    expect(feedback?.message.length).toBeGreaterThan(10);
  });

  it('provides its own fixed grid and complete surface outside the app shell', () => {
    const toast = declarations('.updateToast.updateToast:global(.desktop-update-toast)');
    expect(toast.get('position')).toBe('fixed');
    expect(toast.get('display')).toBe('grid');
    expect(toast.get('grid-template-columns')).toBe('34px minmax(0, 1fr) 28px');
    expect(toast.get('left')).toBe('auto');
    expect(toast.get('bottom')).toBe('auto');
    expect(toast.get('right')).toBe('16px');
    expect(toast.get('padding')).toBe('16px');
    expect(toast.get('border')).toContain('1px solid');
    expect(toast.get('background')).toContain('var(--so-surface, #fff)');
    expect(toast.get('max-width')).toContain('--desktop-zoomed-viewport-width');
    expect(toast.get('max-height')).toContain('--desktop-zoomed-viewport-height');
  });

  it('gives the action a separate row and places dismiss independently of copy length', () => {
    const action = declarations('.updateToast.updateToast :global(.desktop-update-toast-action)');
    const dismiss = declarations('.updateToast.updateToast :global(.desktop-update-toast-dismiss)');
    expect(action.get('grid-column')).toBe('2');
    expect(action.get('grid-row')).toBe('2');
    expect(action.get('max-width')).toBe('100%');
    expect(action.get('white-space')).toBe('normal');
    expect(dismiss.get('grid-column')).toBe('3');
    expect(dismiss.get('grid-row')).toBe('1');
  });

  it('keeps the exit state noninteractive and has an explicit visible position', () => {
    const hidden = declarations('.updateToast.updateToast:global(.desktop-update-toast)');
    const visible = declarations(".updateToast.updateToast:global(.desktop-update-toast)[data-state='open']");
    expect(hidden.get('pointer-events')).toBe('none');
    expect(visible.get('pointer-events')).toBe('auto');
    expect(visible.get('transform')).toBe('translateY(0)');
    const reduced = stylesheet.nodes.filter((node) => node.type === 'atrule' && node.params === '(prefers-reduced-motion: reduce)');
    expect(reduced).toHaveLength(1);
  });
});
