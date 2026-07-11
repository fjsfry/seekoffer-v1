import { createClient } from 'npm:@supabase/supabase-js@2.110.2';

type AnalyticsEvent = {
  visitorId?: unknown;
  sessionId?: unknown;
  eventType?: unknown;
  path?: unknown;
  title?: unknown;
  referrer?: unknown;
  locale?: unknown;
  timezone?: unknown;
};

type SupabaseService = ReturnType<typeof createClient>;

const fallbackAllowedOrigins = ['https://www.seekoffer.com.cn', 'http://localhost:3000', 'http://localhost:3001'];
const visitorIdPattern = /^v_[a-zA-Z0-9_-]{16,90}$/;
const sessionIdPattern = /^s_[a-zA-Z0-9_-]{16,90}$/;

function getAllowedOrigins() {
  const configured = Deno.env.get('SEEKOFFER_ANALYTICS_ALLOWED_ORIGINS') || '';
  const origins = configured
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return origins.length ? origins : fallbackAllowedOrigins;
}

function getCorsHeaders(request: Request) {
  const allowedOrigins = getAllowedOrigins();
  const origin = request.headers.get('origin') || '';
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

function json(request: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/json'
    }
  });
}

function assertAllowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || getAllowedOrigins().includes(origin);
}

function text(value: unknown, maxLength: number) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeEvent(body: AnalyticsEvent, request: Request) {
  const visitorId = text(body.visitorId, 96);
  const sessionId = text(body.sessionId, 96);
  const eventType = body.eventType === 'heartbeat' ? 'heartbeat' : 'pageview';

  if (!visitorIdPattern.test(visitorId)) {
    throw new Error('invalid_visitor_id');
  }

  if (!sessionIdPattern.test(sessionId)) {
    throw new Error('invalid_session_id');
  }

  return {
    visitorId,
    sessionId,
    eventType,
    path: text(body.path, 320) || '/',
    title: text(body.title, 180),
    referrer: text(body.referrer, 320),
    locale: text(body.locale, 40),
    timezone: text(body.timezone, 80),
    userAgent: text(request.headers.get('user-agent'), 420)
  };
}

async function recordAnalytics(service: SupabaseService, event: ReturnType<typeof normalizeEvent>) {
  const { error } = await service.rpc('seekoffer_record_analytics', {
    p_visitor_id: event.visitorId,
    p_session_id: event.sessionId,
    p_event_type: event.eventType,
    p_path: event.path,
    p_title: event.title,
    p_referrer: event.referrer,
    p_locale: event.locale,
    p_timezone: event.timezone,
    p_user_agent: event.userAgent
  });

  if (error) throw error;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return json(request, 405, { error: 'method_not_allowed' });
  }

  if (!assertAllowedOrigin(request)) {
    return json(request, 403, { error: 'origin_not_allowed' });
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 8192) {
    return json(request, 413, { error: 'payload_too_large' });
  }

  const serviceUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!serviceUrl || !serviceRoleKey) {
    return json(request, 500, { error: 'missing_env' });
  }

  try {
    const body = (await request.json()) as AnalyticsEvent;
    const event = normalizeEvent(body, request);
    const service = createClient(serviceUrl, serviceRoleKey);
    await recordAnalytics(service, event);
    return json(request, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith('invalid_') ? 400 : 500;
    return json(request, status, { error: 'analytics_api_failed', message });
  }
});
