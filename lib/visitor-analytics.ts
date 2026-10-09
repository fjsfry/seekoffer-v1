export type PageviewInput = {
  requestId: string;
  visitorId: string;
  sessionId: string;
  path: string;
  title?: string;
  referrer?: string;
  locale?: string;
  timezone?: string;
};

const cleanText = (value: string | undefined, limit: number) =>
  (value || '').replace(/[\u0000-\u001f]/g, '').slice(0, limit);

export function buildPageview(input: PageviewInput) {
  const path = input.path.split(/[?#]/, 1)[0];
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/admin') ||
      path.length > 320 || /[\\\u0000-\u001f]/.test(path)) return null;
  let referrer = '';
  try {
    const url = new URL(input.referrer || '');
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) referrer = url.origin;
  } catch { /* Invalid referrers are optional, not a reason to lose a pageview. */ }
  return {
    requestId: input.requestId, visitorId: input.visitorId, sessionId: input.sessionId,
    eventType: 'pageview' as const, path,
    title: cleanText(input.title, 180), referrer,
    locale: cleanText(input.locale, 40), timezone: cleanText(input.timezone, 80)
  };
}

export function analyticsResumeAt(status: number, code: string, retryAfter: string | null, now: number) {
  if (code === 'ANALYTICS_DAILY_BUDGET') return (Math.floor(now / 86400000) + 1) * 86400000;
  const seconds = Number(retryAfter);
  const headerUntil = retryAfter && !Number.isFinite(seconds) ? Date.parse(retryAfter) : now + Math.max(0, seconds) * 1000;
  const cooldown = status === 400 || status === 409 ? 300000 : 60000;
  return Math.min(now + 86400000, Math.max(now + cooldown, Number.isFinite(headerUntil) ? headerUntil : 0));
}

export async function postPageview(
  url: string,
  payload: NonNullable<ReturnType<typeof buildPageview>>,
  request: typeof fetch = fetch
) {
  const response = await request(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), keepalive: true, credentials: 'omit',
    signal: AbortSignal.timeout(10000)
  });
  const body = await response.json().catch(() => ({})) as { error?: string; recorded?: boolean; deduplicated?: boolean };
  return { ok: response.ok && (body.recorded === true || body.deduplicated === true),
    status: response.status, code: body.error || '', retryAfter: response.headers.get('Retry-After') };
}
