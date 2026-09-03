import { describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_DOWNLOAD_ATTEMPT_ENDPOINT,
  queueDesktopDownloadAttempt,
  type DesktopDownloadAttemptTransport
} from '@/lib/client/desktop-download-attempt';

const ATTEMPT_ID = '018f6b5c-d87a-7cc4-a8d1-7e617c7b16d2';

function createTransport(
  overrides: Partial<DesktopDownloadAttemptTransport> = {}
): DesktopDownloadAttemptTransport {
  return {
    makeAttemptId: vi.fn(() => ATTEMPT_ID),
    sendBeacon: vi.fn(() => true),
    fetcher: vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    ...overrides
  };
}

describe('desktop download attempt queue', () => {
  it('uses Beacon once and does not also send Fetch when the browser accepts the queue', async () => {
    const transport = createTransport();

    expect(queueDesktopDownloadAttempt(transport)).toBe('beacon');
    expect(transport.makeAttemptId).toHaveBeenCalledTimes(1);
    expect(transport.sendBeacon).toHaveBeenCalledTimes(1);
    expect(transport.fetcher).not.toHaveBeenCalled();

    const [url, body] = vi.mocked(transport.sendBeacon! as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(DESKTOP_DOWNLOAD_ATTEMPT_ENDPOINT);
    expect(body).toBeInstanceOf(Blob);
    expect(await body.text()).toBe(`attemptId=${encodeURIComponent(ATTEMPT_ID)}`);
    expect(body.type).toBe('application/x-www-form-urlencoded;charset=utf-8');
  });

  it.each([
    ['returns false', vi.fn(() => false)],
    ['throws', vi.fn(() => { throw new Error('beacon unavailable'); })],
    ['is missing', undefined]
  ])('falls back to one fire-and-forget keepalive Fetch when Beacon %s', (_label, sendBeacon) => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    const transport = createTransport({ sendBeacon, fetcher });

    expect(queueDesktopDownloadAttempt(transport)).toBe('fetch');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(DESKTOP_DOWNLOAD_ATTEMPT_ENDPOINT, {
      method: 'POST',
      body: `attemptId=${encodeURIComponent(ATTEMPT_ID)}`,
      credentials: 'same-origin',
      keepalive: true,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      }
    });
  });

  it('swallows an asynchronous Fetch rejection', async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error('offline')));
    const transport = createTransport({ sendBeacon: undefined, fetcher });

    expect(queueDesktopDownloadAttempt(transport)).toBe('fetch');
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('skips analytics when UUID generation is unavailable without throwing', () => {
    const transport = createTransport({
      makeAttemptId: () => {
        throw new Error('randomUUID unavailable');
      }
    });

    expect(queueDesktopDownloadAttempt(transport)).toBe('skipped');
    expect(transport.sendBeacon).not.toHaveBeenCalled();
    expect(transport.fetcher).not.toHaveBeenCalled();
  });

  it('creates a fresh id for every independent user activation', () => {
    const makeAttemptId = vi
      .fn()
      .mockReturnValueOnce('018f6b5c-d87a-7cc4-a8d1-7e617c7b16d2')
      .mockReturnValueOnce('018f6b5c-d87a-7cc4-a8d1-7e617c7b16d3');
    const sendBeacon = vi.fn(() => true);
    const transport = createTransport({ makeAttemptId, sendBeacon });

    queueDesktopDownloadAttempt(transport);
    queueDesktopDownloadAttempt(transport);

    expect(makeAttemptId).toHaveBeenCalledTimes(2);
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });
});
