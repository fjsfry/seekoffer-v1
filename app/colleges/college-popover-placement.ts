type PopoverPlacementInput = {
  trigger: { right: number; top: number; bottom: number; width: number };
  triggerLayoutWidth: number;
  viewportWidth: number;
  viewportHeight: number;
};

/** Client rects include CSS zoom, while a top-layer popover's style coordinates
 * remain in its inherited CSS coordinate space. Convert both axes together. */
export function collegePopoverPlacement({
  trigger, triggerLayoutWidth, viewportWidth, viewportHeight
}: PopoverPlacementInput) {
  const measuredScale = triggerLayoutWidth > 0 ? trigger.width / triggerLayoutWidth : 1;
  const scale = Number.isFinite(measuredScale) && measuredScale > 0 ? measuredScale : 1;
  const gutter = 12;
  const availableWidth = Math.max(1, viewportWidth - gutter * 2);
  const availableHeight = Math.max(1, viewportHeight - gutter * 2);
  const width = Math.min(420 * scale, availableWidth);
  const maxHeight = Math.min(520 * scale, availableHeight);
  const estimatedHeight = Math.min(470 * scale, maxHeight);
  const left = Math.max(gutter, Math.min(trigger.right - width, viewportWidth - width - gutter));
  const below = trigger.bottom + 6 * scale;
  const preferredTop = below + estimatedHeight <= viewportHeight - gutter
    ? below
    : Math.max(gutter, trigger.top - estimatedHeight - 6 * scale);
  // Account for content growing beyond the estimate; the scrollable body must
  // leave the real header and footer inside the viewport too.
  const top = Math.min(preferredTop, Math.max(gutter, viewportHeight - maxHeight - gutter));
  return {
    left: left / scale,
    top: top / scale,
    width: width / scale,
    maxHeight: Math.min(maxHeight, viewportHeight - top - gutter) / scale
  };
}
