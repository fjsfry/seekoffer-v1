import { DESKTOP_RELEASE } from '@/lib/desktop-download';
import { recordDesktopDownloadAttempt } from '@/lib/server/desktop-download-analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REQUEST_BODY_BYTES = 2_048;
const DOWNLOAD_ANALYTICS_TIMEOUT_MS = 1_350;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AttemptRequestResult =
  | { ok: true; attemptId: string }
  | { ok: false; status: 400 | 415 };

function emptyResponse(status: number) {
  return new Response(null, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}

function hasSameOriginRequestMetadata(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');

  return origin === requestOrigin && (fetchSite === null || fetchSite === 'same-origin');
}

async function readAttemptRequest(request: Request): Promise<AttemptRequestResult> {
  const contentType = (request.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') {
    return { ok: false, status: 415 };
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength < 0 ||
      declaredLength > MAX_REQUEST_BODY_BYTES
    ) {
      return { ok: false, status: 400 };
    }
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return { ok: false, status: 400 };
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BODY_BYTES) {
    return { ok: false, status: 400 };
  }

  const form = new URLSearchParams(rawBody);
  const attemptIds = form.getAll('attemptId');
  if (
    Array.from(form.keys()).some((key) => key !== 'attemptId') ||
    attemptIds.length !== 1 ||
    !UUID_PATTERN.test(attemptIds[0])
  ) {
    return { ok: false, status: 400 };
  }

  return { ok: true, attemptId: attemptIds[0] };
}

async function recordAttemptWithinTimeout(attemptId: string) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const write = recordDesktopDownloadAttempt(
    {
      attemptId,
      releaseVersion: DESKTOP_RELEASE.version,
      platform: 'windows_x86_64',
      source: 'website_download_page'
    },
    controller.signal
  ).then(
    () => 'recorded' as const,
    () => 'failed' as const
  );

  const deadline = new Promise<'timed_out'>((resolve) => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve('timed_out');
    }, DOWNLOAD_ANALYTICS_TIMEOUT_MS);
  });

  try {
    const outcome = await Promise.race([write, deadline]);
    if (outcome !== 'recorded') {
      console.warn('[desktop-download] analytics write skipped', {
        event: 'desktop_download_analytics_write_skipped',
        outcome,
        releaseVersion: DESKTOP_RELEASE.version,
        platform: 'windows_x86_64',
        source: 'website_download_page'
      });
    }
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  if (!hasSameOriginRequestMetadata(request)) {
    return emptyResponse(403);
  }

  const parsed = await readAttemptRequest(request);
  if (!parsed.ok) {
    return emptyResponse(parsed.status);
  }

  await recordAttemptWithinTimeout(parsed.attemptId);
  return emptyResponse(204);
}
