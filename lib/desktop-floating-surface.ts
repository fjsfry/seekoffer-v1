export type DesktopFloatingSurfacePosition = {
  left: number;
  top: number;
};

export function clampDesktopFloatingSurface(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number,
  surfaceWidth: number,
  surfaceHeight: number,
  viewportPadding = 8
): DesktopFloatingSurfacePosition {
  const maxLeft = Math.max(viewportPadding, viewportWidth - surfaceWidth - viewportPadding);
  const maxTop = Math.max(viewportPadding, viewportHeight - surfaceHeight - viewportPadding);

  return {
    left: Math.max(viewportPadding, Math.min(clientX, maxLeft)),
    top: Math.max(viewportPadding, Math.min(clientY, maxTop))
  };
}
