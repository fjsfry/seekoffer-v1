type SchedulePopoverPlacementInput = {
  trigger: { left: number; top: number; bottom: number; width: number };
  triggerLayoutWidth: number;
  viewportWidth: number;
  viewportHeight: number;
  preferredWidth: number;
  estimatedHeight: number;
};

/** Native popovers inherit desktop CSS zoom, but client rects are physical.
 * Clamp in physical pixels first, then convert every dimension together. */
export function schedulePopoverPlacement({
  trigger, triggerLayoutWidth, viewportWidth, viewportHeight, preferredWidth, estimatedHeight
}: SchedulePopoverPlacementInput) {
  const measuredScale = triggerLayoutWidth > 0 ? trigger.width / triggerLayoutWidth : 1;
  const scale = Number.isFinite(measuredScale) && measuredScale > 0 ? measuredScale : 1;
  const gutter = 12;
  const physicalWidth = Math.min(preferredWidth * scale, Math.max(1, viewportWidth - gutter * 2));
  const physicalMaxHeight = Math.min(420 * scale, Math.max(1, viewportHeight - gutter * 2));
  const physicalHeight = Math.min(estimatedHeight * scale, physicalMaxHeight);
  const physicalLeft = Math.max(gutter, Math.min(trigger.left, viewportWidth - physicalWidth - gutter));
  const below = trigger.bottom + 6 * scale;
  const preferredTop = below + physicalHeight <= viewportHeight - gutter
    ? below
    : Math.max(gutter, trigger.top - physicalHeight - 6 * scale);
  const physicalTop = Math.min(preferredTop, Math.max(gutter, viewportHeight - physicalMaxHeight - gutter));
  return {
    left: physicalLeft / scale,
    top: physicalTop / scale,
    width: physicalWidth / scale,
    maxHeight: Math.min(physicalMaxHeight, viewportHeight - physicalTop - gutter) / scale
  };
}

export function schedulePopoverAnchorVisible(
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>,
  viewportWidth: number,
  viewportHeight: number
) {
  return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 &&
    rect.left < viewportWidth && rect.top < viewportHeight;
}

/** Keep a visible anchor attached through late focus/scroll events. The old
 * blanket scroll dismissal could close a newly opened picker before input. */
export function observeSchedulePopoverViewport({
  surface,
  trigger,
  reposition
}: {
  surface: HTMLElement;
  trigger: HTMLElement;
  reposition: () => void;
}) {
  let frame: number | null = null;
  let disposed = false;
  const refresh = () => {
    frame = null;
    if (disposed || !surface.isConnected || !surface.matches(':popover-open')) return;
    const rect = trigger.getBoundingClientRect();
    const style = window.getComputedStyle(trigger);
    if (!trigger.isConnected || !trigger.getClientRects().length ||
      style.visibility === 'hidden' || style.display === 'none' ||
      !schedulePopoverAnchorVisible(rect, window.innerWidth, window.innerHeight)) {
      surface.hidePopover();
      return;
    }
    reposition();
  };
  const schedule = (event?: Event) => {
    if (disposed || (event?.type === 'scroll' && event.target instanceof Node && surface.contains(event.target))) return;
    if (frame === null) frame = window.requestAnimationFrame(refresh);
  };
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule);
  schedule();
  return () => {
    disposed = true;
    document.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    if (frame !== null) window.cancelAnimationFrame(frame);
  };
}
