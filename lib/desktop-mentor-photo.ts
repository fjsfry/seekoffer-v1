const ALLOWED_MENTOR_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_MENTOR_PHOTO_BASE64_LENGTH = 2_800_000;

type MentorPhotoMimeType = (typeof ALLOWED_MENTOR_PHOTO_MIME_TYPES)[number];

export type MentorPhotoResult = {
  mimeType: MentorPhotoMimeType;
  dataUrl: string;
  cacheKey: string;
  sourceUrl: string;
  pageUrl: string;
  width: number;
  height: number;
  confidence: 'high' | 'medium';
};

export type CachedMentorPhotoResult = Pick<MentorPhotoResult, 'mimeType' | 'dataUrl' | 'width' | 'height'>;

export class MentorPhotoClientError extends Error {
  code: string;
  retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = 'MentorPhotoClientError';
    this.code = code;
    this.retryable = retryable;
  }
}

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function isMentorPhotoCacheKey(value: unknown) {
  return /^[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(String(value || '').trim().toLowerCase());
}

function normalizePublicHttpUrl(value: unknown) {
  const text = String(value || '').trim();
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function normalizeMimeType(value: unknown): MentorPhotoMimeType {
  const mimeType = String(value || '').trim().toLowerCase();
  if (ALLOWED_MENTOR_PHOTO_MIME_TYPES.includes(mimeType as MentorPhotoMimeType)) {
    return mimeType as MentorPhotoMimeType;
  }
  throw new MentorPhotoClientError('MENTOR_PHOTO_INVALID_RESPONSE', '导师照片格式校验失败。');
}

export function buildMentorPhotoDataUrl(mimeTypeValue: unknown, base64Value: unknown) {
  const mimeType = normalizeMimeType(mimeTypeValue);
  const bytesBase64 = String(base64Value || '').trim();
  if (
    !bytesBase64 ||
    bytesBase64.length > MAX_MENTOR_PHOTO_BASE64_LENGTH ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(bytesBase64)
  ) {
    throw new MentorPhotoClientError('MENTOR_PHOTO_INVALID_RESPONSE', '导师照片内容校验失败。');
  }
  return `data:${mimeType};base64,${bytesBase64}`;
}

function normalizeDimensions(raw: Record<string, unknown>) {
  const width = Number(raw.width);
  const height = Number(raw.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 120 || height < 120 || width > 4096 || height > 4096) {
    throw new MentorPhotoClientError('MENTOR_PHOTO_INVALID_RESPONSE', '导师照片尺寸校验失败。');
  }
  return { width, height };
}

function normalizeClientError(error: unknown) {
  if (error instanceof MentorPhotoClientError) return error;
  if (error && typeof error === 'object') {
    const raw = error as { code?: unknown; message?: unknown; retryable?: unknown };
    const code = String(raw.code || '').trim();
    const message = String(raw.message || '').trim();
    if (code && message) return new MentorPhotoClientError(code, message, raw.retryable === true);
  }
  return new MentorPhotoClientError(
    'MENTOR_PHOTO_NATIVE_ERROR',
    '暂时无法从导师主页获取照片，请稍后重试。',
    true
  );
}

async function invokeMentorPhotoCommand<T>(command: string, payload: Record<string, unknown>) {
  if (!isTauriRuntime()) {
    throw new MentorPhotoClientError(
      'MENTOR_PHOTO_DESKTOP_ONLY',
      '安装版桌面客户端会从公开导师主页自动查找照片。'
    );
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, payload);
  } catch (error) {
    throw normalizeClientError(error);
  }
}

export async function resolveMentorPhotoFromHomepage(homepage: string): Promise<MentorPhotoResult> {
  const raw = await invokeMentorPhotoCommand<Record<string, unknown>>('resolve_mentor_photo', { homepage });
  const mimeType = normalizeMimeType(raw.mimeType);
  const cacheKey = String(raw.cacheKey || '').trim().toLowerCase();
  const sourceUrl = normalizePublicHttpUrl(raw.sourceUrl);
  const pageUrl = normalizePublicHttpUrl(raw.pageUrl);
  const confidence = raw.confidence === 'high' ? 'high' : raw.confidence === 'medium' ? 'medium' : '';
  const { width, height } = normalizeDimensions(raw);
  if (!isMentorPhotoCacheKey(cacheKey) || !sourceUrl || !pageUrl || !confidence) {
    throw new MentorPhotoClientError('MENTOR_PHOTO_INVALID_RESPONSE', '导师照片来源校验失败。');
  }
  return {
    mimeType,
    dataUrl: buildMentorPhotoDataUrl(mimeType, raw.bytesBase64),
    cacheKey,
    sourceUrl,
    pageUrl,
    width,
    height,
    confidence
  };
}

export async function loadCachedMentorPhoto(cacheKey: string): Promise<CachedMentorPhotoResult> {
  if (!isMentorPhotoCacheKey(cacheKey)) {
    throw new MentorPhotoClientError('MENTOR_PHOTO_INVALID_CACHE_KEY', '导师照片缓存标识无效。');
  }
  const raw = await invokeMentorPhotoCommand<Record<string, unknown>>('load_cached_mentor_photo', { cacheKey });
  const mimeType = normalizeMimeType(raw.mimeType);
  const { width, height } = normalizeDimensions(raw);
  return {
    mimeType,
    dataUrl: buildMentorPhotoDataUrl(mimeType, raw.bytesBase64),
    width,
    height
  };
}
