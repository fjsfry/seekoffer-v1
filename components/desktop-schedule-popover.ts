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
