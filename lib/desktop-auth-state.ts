/** In-memory connection state. Cached profile data is never a cloud credential. */
export type DesktopAuthStatus = 'unknown' | 'ready' | 'offline' | 'reauth-required' | 'signed-out';
export type DesktopAuthState = { status: DesktopAuthStatus; message: string };
let state: DesktopAuthState = { status: 'unknown', message: '' };
const listeners = new Set<() => void>();

export class NativeAuthError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'NativeAuthError';
  }
}

const reauthenticationCodes = new Set([
  'NATIVE_REAUTHENTICATION_REQUIRED', 'NATIVE_LOGIN_EXPIRED',
  'NATIVE_CREDENTIAL_INVALID', 'NATIVE_DPAPI_FAILED',
  'NATIVE_TOKEN_INVALID', 'NATIVE_REFRESH_UNAVAILABLE', 'NATIVE_EXPIRY_INVALID'
]);

export function nativeAuthError(error: unknown): NativeAuthError {
  if (error instanceof NativeAuthError) return error;
  const code = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const messages: Record<string, string> = {
    NATIVE_REAUTHENTICATION_REQUIRED: '为保护账号，请重新在浏览器中授权登录。本机资料与未同步修改均已保留。',
    NATIVE_LOGIN_EXPIRED: '登录授权已失效，请重新登录。本机资料与未同步修改均已保留。',
    NATIVE_LOGIN_TIMEOUT: '登录等待已超时，请重新打开浏览器登录。',
    NATIVE_LOGIN_ALREADY_RUNNING: '系统浏览器中的登录尚未结束，请完成该窗口或等待其超时后重试。',
    NATIVE_LOGIN_CANCELLED: '已取消本次登录，本机资料仍保留。',
    NATIVE_SESSION_CHANGED: '账号已切换，请重新确认当前账号。',
    NATIVE_WINDOW_REJECTED: '请在寻鹿桌面应用中登录。',
    NATIVE_BROWSER_UNAVAILABLE: '未能打开系统浏览器，请检查默认浏览器设置后重试。',
    NATIVE_STORAGE_UNAVAILABLE: '无法保存或清除本机登录凭据，请检查磁盘状态后重试。',
    NATIVE_AUTH_UNAVAILABLE: '暂时无法连接登录服务。可继续查看本机资料，恢复网络后重试。'
  };
  return new NativeAuthError(code || 'NATIVE_AUTH_UNAVAILABLE', messages[code] || (
    reauthenticationCodes.has(code)
      ? '本机登录授权需要更新，请重新登录。本机资料与未同步修改均已保留。'
      : '登录尚未完成，请检查浏览器或网络后重试。本机资料仍保留。'
  ));
}

export function requiresNativeReauthentication(error: unknown): boolean {
  return error instanceof NativeAuthError && reauthenticationCodes.has(error.code);
}
export function isNativeSessionChanged(error: unknown): boolean {
  return error instanceof NativeAuthError && error.code === 'NATIVE_SESSION_CHANGED';
}

export function getDesktopAuthState(): DesktopAuthState { return state; }
export function setDesktopAuthState(status: DesktopAuthStatus, message = '') {
  if (state.status === status && state.message === message) return;
  state = { status, message };
  listeners.forEach(listener => listener());
}
export function watchDesktopAuthState(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
