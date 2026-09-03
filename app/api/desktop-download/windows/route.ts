import { DESKTOP_RELEASE } from '@/lib/desktop-download';
import { recordDesktopDownloadAttempt } from '@/lib/server/desktop-download-analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REQUEST_BODY_BYTES = 2_048;
const DOWNLOAD_ANALYTICS_TIMEOUT_MS = 1_350;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DownloadAttemptRequest = {
  attemptId: string;
};

function installerRedirect() {
  return new Response(null, {
    status: 303,
    headers: {
      Location: DESKTOP_RELEASE.installerUrl,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}

function hasSameOriginNavigationMetadata(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  const matchesWhenPresent = (name: string, expected: string) => {
    const value = request.headers.get(name);
    return value === null || value === expected;
  };

  return (
    origin === requestOrigin &&
    matchesWhenPresent('sec-fetch-site', 'same-origin') &&
    matchesWhenPresent('sec-fetch-mode', 'navigate') &&
    matchesWhenPresent('sec-fetch-user', '?1')
  );
}

async function readAttemptRequest(request: Request): Promise<DownloadAttemptRequest | null> {
  const contentType = (request.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') {
    return null;
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength < 0 ||
      declaredLength > MAX_REQUEST_BODY_BYTES
    ) {
      return null;
    }
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return null;
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BODY_BYTES) {
    return null;
  }

  const form = new URLSearchParams(rawBody);
  const attemptIds = form.getAll('attemptId');
  if (
    Array.from(form.keys()).some((key) => key !== 'attemptId') ||
    attemptIds.length !== 1 ||
    !UUID_PATTERN.test(attemptIds[0])
  ) {
    return null;
  }

  return { attemptId: attemptIds[0] };
}

export async function POST(request: Request) {
  const redirect = installerRedirect();

  if (!hasSameOriginNavigationMetadata(request)) {
    return redirect;
  }

  const parsed = await readAttemptRequest(request);
  if (!parsed) {
    return redirect;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_ANALYTICS_TIMEOUT_MS);

  try {
    await recordDesktopDownloadAttempt(
      {
        attemptId: parsed.attemptId,
        releaseVersion: DESKTOP_RELEASE.version,
        platform: 'windows_x86_64',
        source: 'website_download_page'
      },
      controller.signal
    );
  } catch {
    console.warn('[desktop-download] analytics write skipped', {
      event: 'desktop_download_analytics_write_failed',
      releaseVersion: DESKTOP_RELEASE.version,
      platform: 'windows_x86_64',
      source: 'website_download_page'
    });
  } finally {
    clearTimeout(timeout);
  }

  return redirect;
}
