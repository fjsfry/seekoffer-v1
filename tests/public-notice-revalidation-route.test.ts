import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidateTag } = vi.hoisted(() => ({
  revalidateTag: vi.fn()
}));

vi.mock('next/cache', () => ({
  revalidateTag
}));

import { POST } from '@/app/api/internal/revalidate-notices/route';

const endpoint = 'http://localhost/api/internal/revalidate-notices';
const secret = 'seekoffer-test-revalidation-token-1234567890';
const routeSource = readFileSync(
  resolve(process.cwd(), 'app/api/internal/revalidate-notices/route.ts'),
  'utf8'
);

function buildRequest({
  token = secret,
  body = {},
  rawBody
}: {
  token?: string | null;
  body?: unknown;
  rawBody?: string;
} = {}) {
  const headers = new Headers({
    'content-type': 'application/json'
  });

  if (token !== null) {
    headers.set('x-seekoffer-revalidate-token', token);
  }

  return new Request(endpoint, {
    method: 'POST',
    headers,
    body: rawBody ?? JSON.stringify(body)
  });
}

describe('internal public notice cache revalidation route', () => {
  beforeEach(() => {
    vi.stubEnv('NOTICE_REVALIDATE_TOKEN', secret);
    revalidateTag.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the private server token and a constant-time comparison', () => {
    expect(routeSource).toContain('process.env.NOTICE_REVALIDATE_TOKEN');
    expect(routeSource).not.toContain('NEXT_PUBLIC_NOTICE_REVALIDATE_TOKEN');
    expect(routeSource).toContain("request.headers.get(REVALIDATE_TOKEN_HEADER)");
    expect(routeSource).toContain('timingSafeEqual');
    expect(routeSource).toContain("export const runtime = 'nodejs'");
    expect(routeSource).toContain("export const dynamic = 'force-dynamic'");
  });

  it('fails closed when the private server token is not configured', async () => {
    vi.stubEnv('NOTICE_REVALIDATE_TOKEN', '');
    vi.stubEnv('NEXT_PUBLIC_NOTICE_REVALIDATE_TOKEN', secret);

    const response = await POST(buildRequest());

    expect(response.status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it.each([null, 'wrong', `${secret}-wrong`])(
    'rejects a missing or incorrect token without a length-comparison exception',
    async (token) => {
      const response = await POST(buildRequest({ token }));

      expect(response.status).toBe(401);
      expect(revalidateTag).not.toHaveBeenCalled();
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  );

  it('revalidates the global tag when no IDs are provided', async () => {
    const response = await POST(buildRequest({ body: {} }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      revalidated: {
        global: 'seekoffer-public-notices',
        ids: []
      }
    });
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith('seekoffer-public-notices');
  });

  it('deduplicates IDs and revalidates the global and per-notice tags', async () => {
    const response = await POST(
      buildRequest({
        body: {
          ids: ['baoyantongzhi-127479', ' baoyantongzhi-127479 ', 'notice-two']
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.revalidated.ids).toEqual(['baoyantongzhi-127479', 'notice-two']);
    expect(revalidateTag.mock.calls).toEqual([
      ['seekoffer-public-notices'],
      ['seekoffer-notice:baoyantongzhi-127479'],
      ['seekoffer-notice:notice-two']
    ]);
  });

  it.each([
    { body: { ids: 'notice-one' }, label: 'non-array IDs' },
    { body: { ids: [123] }, label: 'non-string IDs' },
    { body: { ids: [''] }, label: 'empty IDs' },
    { body: { ids: ['x'.repeat(161)] }, label: 'overlong IDs' },
    { body: { ids: Array.from({ length: 101 }, (_, index) => `notice-${index}`) }, label: 'too many IDs' }
  ])('rejects $label', async ({ body }) => {
    const response = await POST(buildRequest({ body }));

    expect(response.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON and oversized request bodies', async () => {
    const malformed = await POST(buildRequest({ rawBody: '{' }));
    const oversized = await POST(
      buildRequest({ rawBody: JSON.stringify({ ids: ['x'], padding: 'y'.repeat(33 * 1024) }) })
    );

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
