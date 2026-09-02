import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REVALIDATE_TOKEN_HEADER = 'x-seekoffer-revalidate-token';
const PUBLIC_NOTICES_TAG = 'seekoffer-public-notices';
const NOTICE_TAG_PREFIX = 'seekoffer-notice:';
const MAX_NOTICE_IDS = 100;
const MAX_NOTICE_ID_LENGTH = 160;
const MAX_REQUEST_BODY_BYTES = 32 * 1024;
const MIN_REVALIDATE_TOKEN_LENGTH = 32;

type RevalidateRequestBody = {
  ids?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store'
    }
  });
}

function securelyMatches(provided: string, expected: string) {
  const providedDigest = createHash('sha256').update(provided, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

function normalizeNoticeIds(value: unknown) {
  if (value === undefined) {
    return { ids: [] as string[] };
  }

  if (!Array.isArray(value)) {
    return { error: '`ids` 必须是字符串数组。' };
  }

  if (value.length > MAX_NOTICE_IDS) {
    return { error: `单次最多可失效 ${MAX_NOTICE_IDS} 条通知。` };
  }

  const ids: string[] = [];
  const seen = new Set<string>();

  for (const candidate of value) {
    if (typeof candidate !== 'string') {
      return { error: '`ids` 中的每一项都必须是字符串。' };
    }

    const id = candidate.trim();
    if (!id || id.length > MAX_NOTICE_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(id)) {
      return { error: `每个通知 ID 必须为 1-${MAX_NOTICE_ID_LENGTH} 个有效字符。` };
    }

    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return { ids };
}

async function readRequestBody(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    return { error: '请求体过大。' };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BODY_BYTES) {
    return { error: '请求体过大。' };
  }

  if (!rawBody.trim()) {
    return { body: {} as RevalidateRequestBody };
  }

  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: '请求体必须是 JSON 对象。' };
    }

    return { body: parsed as RevalidateRequestBody };
  } catch {
    return { error: '请求体不是有效的 JSON。' };
  }
}

export async function POST(request: Request) {
  const expectedToken = process.env.NOTICE_REVALIDATE_TOKEN || '';
  if (expectedToken.length < MIN_REVALIDATE_TOKEN_LENGTH) {
    return jsonResponse({ ok: false, error: '通知缓存失效服务尚未配置。' }, 503);
  }

  const providedToken = request.headers.get(REVALIDATE_TOKEN_HEADER) || '';
  if (!securelyMatches(providedToken, expectedToken)) {
    return jsonResponse({ ok: false, error: '未授权。' }, 401);
  }

  const parsedRequest = await readRequestBody(request);
  if ('error' in parsedRequest) {
    return jsonResponse({ ok: false, error: parsedRequest.error }, 400);
  }

  const normalized = normalizeNoticeIds(parsedRequest.body.ids);
  if ('error' in normalized) {
    return jsonResponse({ ok: false, error: normalized.error }, 400);
  }

  try {
    revalidateTag(PUBLIC_NOTICES_TAG);
    normalized.ids.forEach((id) => revalidateTag(`${NOTICE_TAG_PREFIX}${id}`));

    return jsonResponse(
      {
        ok: true,
        revalidated: {
          global: PUBLIC_NOTICES_TAG,
          ids: normalized.ids
        }
      },
      200
    );
  } catch {
    return jsonResponse({ ok: false, error: '通知缓存失效失败。' }, 500);
  }
}
