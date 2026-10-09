import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeSchedulePopoverViewport, schedulePopoverAnchorVisible } from '../components/desktop-schedule-popover';

function fixture() {
  class FakeNode {}
  const frames = new Map<number, FrameRequestCallback>();
  const documentListeners = new Map<string, EventListener>();
  const windowListeners = new Map<string, EventListener>();
  let nextFrame = 1;
  let open = true;
  const inside = new FakeNode();
  const rect = { left: 100, right: 260, top: 300, bottom: 340, width: 160, height: 40 };
  const trigger = { isConnected: true, getBoundingClientRect: () => rect, getClientRects: () => [rect] };
  const surface = {
    isConnected: true,
    matches: () => open,
    contains: (target: unknown) => target === inside,
    hidePopover: vi.fn(() => { open = false; })
  };
  const removeDocument = vi.fn((name: string) => documentListeners.delete(name));
  const removeWindow = vi.fn((name: string) => windowListeners.delete(name));
  vi.stubGlobal('Node', FakeNode);
  vi.stubGlobal('document', {
    addEventListener: (name: string, listener: EventListener) => documentListeners.set(name, listener),
    removeEventListener: removeDocument
  });
  vi.stubGlobal('window', {
    innerWidth: 960, innerHeight: 640,
    getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
    requestAnimationFrame: (callback: FrameRequestCallback) => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    addEventListener: (name: string, listener: EventListener) => windowListeners.set(name, listener),
    removeEventListener: removeWindow
  });
  const reposition = vi.fn();
  const stop = observeSchedulePopoverViewport({ surface: surface as unknown as HTMLElement, trigger: trigger as unknown as HTMLElement, reposition });
  const flush = () => { const pending = [...frames]; frames.clear(); for (const [, callback] of pending) callback(0); };
  const scroll = (target: unknown = new FakeNode()) => documentListeners.get('scroll')?.({ type: 'scroll', target } as unknown as Event);
  const resize = () => windowListeners.get('resize')?.({ type: 'resize' } as Event);
  return { frames, rect, trigger, surface, reposition, stop, flush, scroll, resize, inside, removeDocument, removeWindow };
}

describe('desktop schedule popover lifecycle', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps a visible picker open and coalesces late external scroll plus resize into one reposition', () => {
    const f = fixture(); f.flush(); f.reposition.mockClear();
    f.scroll(); f.scroll(); f.resize();
    expect(f.frames.size).toBe(1);
    expect(f.surface.hidePopover).not.toHaveBeenCalled();
    f.flush();
    expect(f.reposition).toHaveBeenCalledTimes(1);
    expect(f.surface.hidePopover).not.toHaveBeenCalled();
    f.stop();
  });

  it('ignores scrolling inside the picker rather than shifting its own content', () => {
    const f = fixture(); f.flush(); f.reposition.mockClear();
    f.scroll(f.inside);
    expect(f.frames.size).toBe(0);
    expect(f.reposition).not.toHaveBeenCalled();
    expect(f.surface.hidePopover).not.toHaveBeenCalled();
    f.stop();
  });

  it('closes only once the anchor leaves the viewport or disconnects', () => {
    for (const disconnected of [false, true]) {
      const f = fixture(); f.flush(); f.reposition.mockClear();
      if (disconnected) f.trigger.isConnected = false;
      else { f.rect.top = 650; f.rect.bottom = 690; }
      f.scroll(); f.flush();
      expect(f.surface.hidePopover).toHaveBeenCalledTimes(1);
      expect(f.reposition).not.toHaveBeenCalled();
      f.stop();
    }
  });

  it('removes listeners and cancels queued work on close/unmount, including an already delivered callback', () => {
    const f = fixture();
    const staleFrame = [...f.frames.values()][0];
    f.stop();
    expect(f.frames.size).toBe(0);
    expect(f.removeDocument).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(f.removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    staleFrame(0); f.scroll(); f.resize();
    expect(f.reposition).not.toHaveBeenCalled();
    expect(f.surface.hidePopover).not.toHaveBeenCalled();
  });

  it('does not reposition an already dismissed surface from a stale scroll frame', () => {
    const f = fixture(); f.flush(); f.reposition.mockClear();
    f.scroll(); f.surface.hidePopover(); f.flush();
    expect(f.reposition).not.toHaveBeenCalled();
    f.stop();
  });

  it('accepts partial visibility but rejects zero-size or fully offscreen anchors', () => {
    expect(schedulePopoverAnchorVisible({ left: -20, right: 40, top: 10, bottom: 50, width: 60, height: 40 }, 960, 640)).toBe(true);
    expect(schedulePopoverAnchorVisible({ left: 960, right: 1020, top: 10, bottom: 50, width: 60, height: 40 }, 960, 640)).toBe(false);
    expect(schedulePopoverAnchorVisible({ left: 20, right: 20, top: 10, bottom: 50, width: 0, height: 40 }, 960, 640)).toBe(false);
  });

  it('wires synchronous non-scrolling return focus, cancellable initial focus, and nested Escape priority', () => {
    const source = readFileSync(resolve(import.meta.dirname, '../components/desktop-schedule-workspace.tsx'), 'utf8');
    const close = source.slice(source.indexOf('function closePopover('), source.indexOf('function useAnchoredPopoverOnViewportChange('));
    expect(close).toContain('returnFocus.focus({ preventScroll: true })');
    expect(close).not.toContain('requestAnimationFrame');
    expect(source).toContain('window.cancelAnimationFrame(focusFrame)');
    expect(source).toContain("surface.isConnected && surface.matches(':popover-open')");
    const escape = source.slice(source.indexOf("if (event.key === 'Escape' && detailOpen)"), source.indexOf('const confirmDescription'));
    expect(escape.indexOf("'[popover]:popover-open'")).toBeLessThan(escape.indexOf('closeDetail()'));
    expect(escape).toContain('closePopover(popover, trigger)');
    expect(escape).toContain('event.stopPropagation()');
    expect(source).not.toContain('useDismissPopoverOnViewportChange');
  });
});
