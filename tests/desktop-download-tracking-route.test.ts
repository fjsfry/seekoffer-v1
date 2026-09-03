import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_RELEASE } from '@/lib/desktop-download';

const recordDesktopDownloadAttempt = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/desktop-download-analytics', () => ({
  recordDesktopDownloadAttempt
}));

import * as route from '@/app/api/desktop-download/windows/route';

const ATTEMPT_ID = '018f6b5c-d87a-7cc4-a8d1-7e617c7b16d2';
const routeSource = readFileSync(
  resolve(process.cwd(), 'app/api/desktop-download/windows/route.ts'),
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
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-user': '?1'
  });

  Object.entries(headerOverrides).forEach(([name, value]) => {
    if (value === undefined) headers.delete(name);
    else headers.set(name, value);
  });

  return new Request('https://www.seekoffer.com.cn/api/desktop-download/windows/', {
    method: 'POST',
    headers,
    body
  });
}

function expectInstallerRedirect(response: Response) {
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe(DESKTOP_RELEASE.installerUrl);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
}

describe('desktop download tracking route', () => {
  beforeEach(() => {
    vi.useRealTimers();
    recordDesktopDownloadAttempt.mockReset();
    recordDesktopDownloadAttempt.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records one fixed server-owned event and redirects to the immutable installer', async () => {
    const response = await route.POST(makeRequest());

    expectInstallerRedirect(response);
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

  it('allows privacy and older browsers that omit optional Sec-Fetch metadata', async () => {
    const response = await route.POST(
      makeRequest(undefined, {
        'sec-fetch-site': undefined,
        'sec-fetch-mode': undefined,
        'sec-fetch-user': undefined
      })
    );

    expectInstallerRedirect(response);
    expect(recordDesktopDownloadAttempt).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['cross-origin request', makeRequest(undefined, { origin: 'https://example.com' })],
    ['invalid fetch metadata', makeRequest(undefined, { 'sec-fetch-user': '' })],
    ['wrong media type', makeRequest(undefined, { 'content-type': 'application/json' })],
    ['invalid UUID', makeRequest('attemptId=not-a-uuid')],
    ['duplicate ID', makeRequest(`attemptId=${ATTEMPT_ID}&attemptId=${ATTEMPT_ID}`)],
    ['client-owned fields', makeRequest(`attemptId=${ATTEMPT_ID}&platform=macos`)]
  ])('does not count a %s, but still starts the installer redirect', async (_label, request) => {
    const response = await route.POST(request);

    expectInstallerRedirect(response);
    expect(recordDesktopDownloadAttempt).not.toHaveBeenCalled();
  });

  it('does not let an analytics failure block the download', async () => {
    recordDesktopDownloadAttempt.mockRejectedValueOnce(new Error('database unavailable'));

    const response = await route.POST(makeRequest());

    expectInstallerRedirect(response);
    expect(recordDesktopDownloadAttempt).toHaveBeenCalledTimes(1);
  });

  it('aborts a stalled write within the bounded timeout and still redirects', async () => {
    vi.useFakeTimers();
    recordDesktopDownloadAttempt.mockImplementationOnce(
      (_attempt: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        })
    );

    const responsePromise = route.POST(makeRequest());
    await vi.advanceTimersByTimeAsync(analyticsTimeoutMs);
    const response = await responsePromise;

    expect(analyticsTimeoutMs).toBeGreaterThanOrEqual(1_200);
    expect(analyticsTimeoutMs).toBeLessThanOrEqual(1_500);
    expectInstallerRedirect(response);
  });

  it('does not export a GET handler that could turn crawlers into download events', () => {
    expect('GET' in route).toBe(false);
  });
});
