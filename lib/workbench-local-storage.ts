export const WORKBENCH_COMPLETED_TODOS_KEY = 'seekoffer-workbench-completed-todos';
export const WORKBENCH_CUSTOM_TODOS_KEY = 'seekoffer-workbench-custom-todos';
export const WORKBENCH_CONTACTS_KEY = 'seekoffer-workbench-mentor-contacts';

export function getAccountScopedWorkbenchKey(baseKey: string, ownerId: string) {
  const normalizedOwner = ownerId.trim() || 'local-device';
  return `${baseKey}:owner:${normalizedOwner}`;
}

export function readAccountScopedWorkbenchValue(baseKey: string, ownerId: string) {
  if (typeof window === 'undefined') return null;

  const scopedKey = getAccountScopedWorkbenchKey(baseKey, ownerId);
  try {
    const scopedValue = window.localStorage.getItem(scopedKey);
    if (scopedValue !== null) return scopedValue;

    // One-time migration: the first signed-in owner keeps the data created by
    // older desktop builds. Removing the legacy key prevents later accounts on
    // the same Windows device from inheriting it.
    if (ownerId.trim()) {
      const legacyValue = window.localStorage.getItem(baseKey);
      if (legacyValue !== null) {
        window.localStorage.setItem(scopedKey, legacyValue);
        window.localStorage.removeItem(baseKey);
        return legacyValue;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function writeAccountScopedWorkbenchValue(
  baseKey: string,
  ownerId: string,
  value: string
) {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.setItem(getAccountScopedWorkbenchKey(baseKey, ownerId), value);
    return true;
  } catch {
    return false;
  }
}
