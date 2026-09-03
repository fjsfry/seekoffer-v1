export const DESKTOP_DOWNLOAD_ATTEMPT_ENDPOINT = '/api/desktop-download/attempt/';

const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded;charset=UTF-8';

export type DesktopDownloadAttemptQueueResult = 'beacon' | 'fetch' | 'skipped';

export type DesktopDownloadAttemptTransport = {
  makeAttemptId: () => string;
  sendBeacon?: (url: string, data: Blob) => boolean;
  fetcher?: typeof fetch;
};

function getBrowserTransport(): DesktopDownloadAttemptTransport | null {
  if (typeof window === 'undefined') return null;

  return {
    makeAttemptId: () => window.crypto.randomUUID(),
    sendBeacon:
      typeof window.navigator.sendBeacon === 'function'
        ? window.navigator.sendBeacon.bind(window.navigator)
        : undefined,
    fetcher: typeof window.fetch === 'function' ? window.fetch.bind(window) : undefined
  };
}

export function queueDesktopDownloadAttempt(
  transport: DesktopDownloadAttemptTransport | null = getBrowserTransport()
): DesktopDownloadAttemptQueueResult {
  if (!transport) return 'skipped';

  let attemptId: string;
  try {
    attemptId = transport.makeAttemptId();
  } catch {
    return 'skipped';
  }

  const encodedBody = new URLSearchParams({ attemptId }).toString();
  const beaconBody = new Blob([encodedBody], { type: FORM_CONTENT_TYPE });

  try {
    if (
      typeof transport.sendBeacon === 'function' &&
      transport.sendBeacon(DESKTOP_DOWNLOAD_ATTEMPT_ENDPOINT, beaconBody)
    ) {
      return 'beacon';
    }
  } catch {
    // A rejected Beacon queue falls through to the fire-and-forget Fetch path.
  }

  if (typeof transport.fetcher !== 'function') return 'skipped';

  try {
    void transport
      .fetcher(DESKTOP_DOWNLOAD_ATTEMPT_ENDPOINT, {
        method: 'POST',
        body: encodedBody,
        credentials: 'same-origin',
        keepalive: true,
        headers: {
          'Content-Type': FORM_CONTENT_TYPE
        }
      })
      .catch(() => undefined);
    return 'fetch';
  } catch {
    return 'skipped';
  }
}
