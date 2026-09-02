import { getPublicNoticesByIds } from '@/lib/server/public-notice-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IDS = 100;
const MAX_REQUEST_BODY_BYTES = 32 * 1024;

function normalizeIds(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_IDS) {
    return null;
  }

  const ids = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const id = item.trim();
    if (!id || id.length > 180 || /[\u0000-\u001f\u007f]/.test(id)) return null;
    ids.add(id);
  }
  return Array.from(ids);
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    return Response.json({ error: 'payload_too_large' }, { status: 413 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BODY_BYTES) {
    return Response.json({ error: 'payload_too_large' }, { status: 413 });
  }

  let body: { ids?: unknown } | null = null;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as { ids?: unknown }
      : null;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body || !Array.isArray(body.ids)) {
    return Response.json({ error: 'ids_must_be_an_array' }, { status: 400 });
  }
  const ids = normalizeIds(body.ids);
  if (!ids) {
    return Response.json({ error: 'invalid_ids' }, { status: 400 });
  }
  const result = await getPublicNoticesByIds(ids);

  return Response.json(result, {
    headers: {
      'Cache-Control': 'private, max-age=60'
    }
  });
}
