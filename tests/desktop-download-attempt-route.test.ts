import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_RELEASE } from '@/lib/desktop-download';

const recordDesktopDownloadAttempt = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/desktop-download-analytics', () => ({
  recordDesktopDownloadAttempt
}));

import * as route from '@/app/api/desktop-download/attempt/route';

const ATTEMPT_ID = '018f6b5c-d87a-7cc4-a8d1-7e617c7b16d2';
const routeSource = readFileSync(
  resolve(process.cwd(), 'app/api/desktop-download/attempt/route.ts'),
  'utf8'
);
const timeoutMatch = routeSource.match(/DOWNLOAD_ANALYTICS_TIMEOUT_MS\s*=\s*([\d_]+)/);
const analyticsTimeoutMs = Number((timeoutMatch?.[1] || '0').replaceAll('_', ''));

function makeRequest(
  body = `attemptId=${encodeURIComponent(ATTEMPT_ID)}`,
  headerOverrides: Record<string, string | undefined> = {}
) {
  const headers = new Headers({
    origin: 'https://www.seekoffer.com.cn',
    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    'sec-fetch-site': 'same-origin'
  });

  Object.entries(headerOverrides).forEach(([name, value]) => {
    if (value === undefined) headers.delete(name);
    else headers.set(name, value);
  });

  return new Request('https://www.seekoffer.com.cn/api/desktop-download/attempt/', {
    method: 'POST',
    headers,
    body
  });
}

async function expectEmptyResponse(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(response.headers.get('location')).toBeNull();
  expect(await response.text()).toBe('');
}

describe('desktop download attempt analytics route', () => {
  beforeEach(() => {
    vi.useRealTimers();
    recordDesktopDownloadAttempt.mockReset();
    recordDesktopDownloadAttempt.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records only the UUID while fixing release metadata on the server', async () => {
    const response = await route.POST(makeRequest());

    await expectEmptyResponse(response, 204);
    expect(recordDesktopDownloadAttempt).toHaveBeenCalledTimes(1);
    expect(recordDesktopDownloadAttempt).toHaveBeenCalledWith(
      {
        attemptId: ATTEMPT_ID,
        releaseVersion: DESKTOP_RELEASE.version,
        platform: 'windows_x86_64',
        source: 'website_download_page'
      },
      expect.any(AbortSignal)
    );
  });

  it('accepts a same-origin request when Sec-Fetch-Site is unavailable', async () => {
    const response = await route.POST(
      makeRequest(undefined, { 'sec-fetch-site': undefined })
    );

    await expectEmptyResponse(response, 204);
    expect(recordDesktopDownloadAttempt).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['cross-origin Origin', makeRequest(undefined, { origin: 'https://example.com' })],
    ['missing Origin', makeRequest(undefined, { origin: undefined })],
    ['cross-site fetch metadata', makeRequest(undefined, { 'sec-fetch-site': 'cross-site' })]
  ])('rejects %s with 403 and never writes', async (_label, request) => {
    const response = await route.POST(request);

    await expectEmptyResponse(response, 403);
    expect(recordDesktopDownloadAttempt).not.toHaveBeenCalled();
  });

  it.each([
    ['JSON', makeRequest('{"attemptId":"value"}', { 'content-type': 'application/json' })],
    ['missing Content-Type', makeRequest(undefined, { 'content-type': undefined })],
    ['plain text', makeRequest(`attemptId=${ATTEMPT_ID}`, { 'content-type': 'text/plain' })]
  ])('rejects the %s media type with 415 and never writes', async (_label, request) => {
    const response = await route.POST(request);

    await expectEmptyResponse(response, 415);
    expect(recordDesktopDownloadAttempt).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid UUID', makeRequest('attemptId=not-a-uuid')],
    ['missing ID', makeRequest('')],
    ['duplicate ID', makeRequest(`attemptId=${ATTEMPT_ID}&attemptId=${ATTEMPT_ID}`)],
    ['client-owned release data', makeRequest(`attemptId=${ATTEMPT_ID}&releaseVersion=9.9.9`)],
    ['actual body over 2 KB', makeRequest(`attemptId=${'a'.repeat(2_100)}`)],
    [
      'declared body over 2 KB',
      makeRequest(undefined, { 'content-length': '2049' })
    ]
  ])('rejects a %s with 400 and never writes', async (_label, request) => {
    const response = await route.POST(request);

    await expectEmptyResponse(response, 400);
    expect(recordDesktopDownloadAttempt).not.toHaveBeenCalled();
  });

  it('returns the same empty 204 when the database write fails', async () => {
    recordDesktopDownloadAttempt.mockRejectedValueOnce(
      new Error('sensitive database details must not escape')
    );

    const response = await route.POST(makeRequest());

    await expectEmptyResponse(response, 204);
    expect(recordDesktopDownloadAttempt).toHaveBeenCalledTimes(1);
  });

  it('enforces a hard 1.35 second deadline even when a writer ignores AbortSignal', async () => {
    vi.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    recordDesktopDownloadAttempt.mockImplementationOnce(
      (_attempt: unknown, signal: AbortSignal) => {
        receivedSignal = signal;
        return new Promise(() => undefined);
      }
    );

    const responsePromise = route.POST(makeRequest());
    await vi.advanceTimersByTimeAsync(analyticsTimeoutMs);
    const response = await responsePromise;

    expect(analyticsTimeoutMs).toBe(1_350);
    expect(receivedSignal?.aborted).toBe(true);
    await expectEmptyResponse(response, 204);
  });

  it('does not export a GET handler or redirect users', () => {
    expect('GET' in route).toBe(false);
    expect(routeSource).not.toContain('Location:');
    expect(routeSource).not.toContain('Response.redirect');
  });
});
