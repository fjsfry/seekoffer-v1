export function writeSessionStorageValue(key: string, value: string) {
  if (typeof window === 'undefined') return false;

  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeSessionStorageValue(key: string) {
  if (typeof window === 'undefined') return false;

  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
