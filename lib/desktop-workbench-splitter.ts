export const DESKTOP_WORKBENCH_PANE_PREFERENCE_KEY =
  'seekoffer-desktop-workbench-pane-width-v1';

export const DESKTOP_WORKBENCH_MIN_LEFT_WIDTH = 336;
export const DESKTOP_WORKBENCH_MAX_LEFT_WIDTH = 720;
export const DESKTOP_WORKBENCH_DEFAULT_LEFT_WIDTH = DESKTOP_WORKBENCH_MAX_LEFT_WIDTH;
export const DESKTOP_WORKBENCH_MIN_RIGHT_WIDTH = 560;
export const DESKTOP_WORKBENCH_KEYBOARD_STEP = 16;
export const DESKTOP_WORKBENCH_KEYBOARD_LARGE_STEP = 48;

const desktopWorkbenchPanePreferenceVersion = 1;

export type DesktopWorkbenchPaneBounds = {
  min: number;
  max: number;
};

type DesktopWorkbenchPanePreference = {
  version: typeof desktopWorkbenchPanePreferenceVersion;
  leftPaneWidth: number;
};

export function getDesktopWorkbenchPaneBounds(
  layoutWidth: number
): DesktopWorkbenchPaneBounds {
  const normalizedLayoutWidth = Number.isFinite(layoutWidth)
    ? Math.max(0, Math.floor(layoutWidth))
    : 0;
  const widthAllowedByDetail = normalizedLayoutWidth - DESKTOP_WORKBENCH_MIN_RIGHT_WIDTH;

  return {
    min: DESKTOP_WORKBENCH_MIN_LEFT_WIDTH,
    max: Math.max(
      DESKTOP_WORKBENCH_MIN_LEFT_WIDTH,
      Math.min(DESKTOP_WORKBENCH_MAX_LEFT_WIDTH, widthAllowedByDetail)
    )
  };
}

export function clampDesktopWorkbenchLeftPaneWidth(
  preferredWidth: number,
  layoutWidth: number
) {
  const bounds = getDesktopWorkbenchPaneBounds(layoutWidth);
  const normalizedPreferredWidth = Number.isFinite(preferredWidth)
    ? preferredWidth
    : DESKTOP_WORKBENCH_DEFAULT_LEFT_WIDTH;

  return Math.round(Math.min(bounds.max, Math.max(bounds.min, normalizedPreferredWidth)));
}

export function getDesktopWorkbenchKeyboardPaneWidth({
  key,
  shiftKey,
  currentWidth,
  layoutWidth
}: {
  key: string;
  shiftKey: boolean;
  currentWidth: number;
  layoutWidth: number;
}) {
  const bounds = getDesktopWorkbenchPaneBounds(layoutWidth);
  const current = clampDesktopWorkbenchLeftPaneWidth(currentWidth, layoutWidth);
  const step = shiftKey
    ? DESKTOP_WORKBENCH_KEYBOARD_LARGE_STEP
    : DESKTOP_WORKBENCH_KEYBOARD_STEP;

  if (key === 'Home') return bounds.min;
  if (key === 'End') return bounds.max;
  if (key === 'ArrowLeft') {
    return clampDesktopWorkbenchLeftPaneWidth(current - step, layoutWidth);
  }
  if (key === 'ArrowRight') {
    return clampDesktopWorkbenchLeftPaneWidth(current + step, layoutWidth);
  }
  return null;
}

export function parseDesktopWorkbenchPanePreference(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DesktopWorkbenchPanePreference>;
    if (
      parsed.version !== desktopWorkbenchPanePreferenceVersion ||
      !Number.isFinite(parsed.leftPaneWidth)
    ) {
      return null;
    }
    return Number(parsed.leftPaneWidth);
  } catch {
    return null;
  }
}

export function readDesktopWorkbenchPanePreference(storage: Pick<Storage, 'getItem'>) {
  try {
    return parseDesktopWorkbenchPanePreference(
      storage.getItem(DESKTOP_WORKBENCH_PANE_PREFERENCE_KEY)
    );
  } catch {
    return null;
  }
}

export function writeDesktopWorkbenchPanePreference(
  storage: Pick<Storage, 'setItem'>,
  leftPaneWidth: number
) {
  if (!Number.isFinite(leftPaneWidth)) return false;
  try {
    storage.setItem(
      DESKTOP_WORKBENCH_PANE_PREFERENCE_KEY,
      JSON.stringify({
        version: desktopWorkbenchPanePreferenceVersion,
        leftPaneWidth: Math.round(leftPaneWidth)
      } satisfies DesktopWorkbenchPanePreference)
    );
    return true;
  } catch {
    return false;
  }
}
