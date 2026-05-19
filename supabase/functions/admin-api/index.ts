import { createClient } from 'npm:@supabase/supabase-js@2';

type AdminUser = {
  email: string;
  name: string;
  role: string;
  status: string;
};

type SupabaseService = ReturnType<typeof createClient>;
const allowedSettingKeys = new Set([
  'content_review_enabled',
  'offer_submit_enabled',
  'report_alert_enabled',
  'operation_log_retention_days'
]);

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': Deno.env.get('SEEKOFFER_ADMIN_ALLOWED_ORIGIN') || 'https://www.seekoffer.com.cn',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(),
      'Content-Type': 'application/json'
    }
  });
}

function mapNoticeStatus(status: string) {
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  if (status === 'hidden') return 'hidden';
  if (status === 'deleted') return 'deleted';
  return 'published';
}

function mapOfferStatus(status: string) {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'hidden') return 'hidden';
  if (status === 'deleted') return 'deleted';
  return 'pending';
}

function mapFeedbackStatus(status: string) {
  if (status === 'processing') return 'processing';
  if (status === 'resolved') return 'resolved';
  if (status === 'closed') return 'closed';
  return 'pending';
}

function requireOneOf(value: unknown, allowedValues: string[], field: string) {
  const normalized = String(value || '').trim();
  if (!allowedValues.includes(normalized)) {
    throw new Error(`invalid_${field}`);
  }
  return normalized;
}

type AdminPermission = 'overview:read' | 'content:write' | 'users:write' | 'settings:write' | 'logs:read';

function requireAdminPermission(admin: AdminUser, permission: AdminPermission) {
  const permissionsByRole: Record<string, Set<string>> = {
    super_admin: new Set(['overview:read', 'content:write', 'users:write', 'settings:write', 'logs:read']),
    ops_manager: new Set(['overview:read', 'content:write', 'users:write', 'logs:read']),
    content_reviewer: new Set(['overview:read', 'content:write']),
    readonly_admin: new Set(['overview:read', 'logs:read'])
  };
  const rolePermissions = permissionsByRole[admin.role] || new Set<string>();

  if (!rolePermissions.has(permission)) {
    throw new Error('admin_permission_denied');
  }
}

function normalizeSettingValue(key: string, value: unknown) {
  if (key === 'operation_log_retention_days') {
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized < 7 || normalized > 3650) {
      throw new Error('invalid_setting_value');
    }

    return normalized;
  }

  if (['content_review_enabled', 'offer_submit_enabled', 'report_alert_enabled'].includes(key)) {
    if (typeof value !== 'boolean') {
      throw new Error('invalid_setting_value');
    }

    return value;
  }

  throw new Error('invalid_setting_key');
}

function readPage(body: Record<string, unknown>) {
  return Math.max(1, Number(body.page || 1) || 1);
}

function readPageSize(body: Record<string, unknown>) {
  return Math.min(100, Math.max(5, Number(body.pageSize || 10) || 10));
}

function readFilters(body: Record<string, unknown>) {
  return (body.filters && typeof body.filters === 'object' ? body.filters : {}) as Record<string, unknown>;
}

function normalizeFilter(value: unknown) {
  return String(value || '').trim();
}

function likePattern(value: unknown) {
  return `%${normalizeFilter(value).replace(/[%_,]/g, ' ')}%`;
}

function getShanghaiDayStart(offsetDays = 0) {
  const now = new Date();
  const shanghaiNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  shanghaiNow.setUTCDate(shanghaiNow.getUTCDate() + offsetDays);
  const day = shanghaiNow.toISOString().slice(0, 10);
  return new Date(`${day}T00:00:00+08:00`);
}

function formatShanghaiDay(offsetDays: number) {
  const date = getShanghaiDayStart(offsetDays);
  const shanghai = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shanghai.toISOString().slice(5, 10);
}

function createTrendSkeleton() {
  return Array.from({ length: 7 }, (_, index) => {
    const offset = index - 6;
    return {
      date: formatShanghaiDay(offset),
      start: getShanghaiDayStart(offset).toISOString(),
      end: getShanghaiDayStart(offset + 1).toISOString(),
      users: 0,
      notices: 0,
      offers: 0,
      applications: 0
    };
  });
}

function incrementTrend(trends: ReturnType<typeof createTrendSkeleton>, createdAt: string | null | undefined, key: 'users' | 'notices' | 'offers' | 'applications') {
  if (!createdAt) return;
  const timestamp = new Date(createdAt).getTime();
  const bucket = trends.find((item) => timestamp >= new Date(item.start).getTime() && timestamp < new Date(item.end).getTime());
  if (bucket) {
    bucket[key] += 1;
  }
}

async function countRows(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const result = await query;
  if (result.error) throw result.error;
  return result.count || 0;
}

function createOnlineWindowStart(minutes = 2) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

async function getAnalyticsOverview(service: SupabaseService) {
  const activeWindowMinutes = 2;
  const onlineSince = createOnlineWindowStart(activeWindowMinutes);
  const todayStart = getShanghaiDayStart(0).toISOString();

  const [onlineVisitors, totalVisitors, todayVisitors, todayPageViews, onlineRows, recentRows] = await Promise.all([
    countRows(service.from('site_visitors').select('visitor_id', { count: 'exact', head: true }).gte('last_seen_at', onlineSince)),
    countRows(service.from('site_visitors').select('visitor_id', { count: 'exact', head: true })),
    countRows(service.from('site_visitors').select('visitor_id', { count: 'exact', head: true }).gte('first_seen_at', todayStart)),
    countRows(service.from('site_visit_events').select('id', { count: 'exact', head: true }).eq('event_type', 'pageview').gte('created_at', todayStart)),
    service
      .from('site_visitors')
      .select('visitor_id,first_seen_at,last_seen_at,last_path,last_title,last_referrer,last_locale,last_timezone,visit_count,page_view_count')
      .gte('last_seen_at', onlineSince)
      .order('last_seen_at', { ascending: false })
      .limit(12),
    service
      .from('site_visitors')
      .select('visitor_id,first_seen_at,last_seen_at,last_path,last_title,last_referrer,last_locale,last_timezone,visit_count,page_view_count')
      .order('last_seen_at', { ascending: false })
      .limit(12)
  ]);

  if (onlineRows.error) throw onlineRows.error;
  if (recentRows.error) throw recentRows.error;

  return {
    metrics: {
      onlineVisitors,
      totalVisitors,
      todayVisitors,
      todayPageViews,
      activeWindowMinutes
    },
    onlineVisitors: onlineRows.data || [],
    recentVisitors: recentRows.data || []
  };
}

async function logOperation(
  service: SupabaseService,
  admin: AdminUser,
  request: Request,
  action: string,
  module: string,
  targetId: string,
  beforeData: unknown,
  afterData: unknown,
  remark = ''
) {
  await service.from('admin_operation_logs').insert({
    admin_email: admin.email,
    action,
    module,
    target_id: targetId,
    before_data: beforeData || {},
    after_data: afterData || {},
    ip_address: request.headers.get('x-forwarded-for') || '',
    result: 'success',
    remark
  });
}

async function requireAdmin(request: Request) {
  const serviceUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

  if (!serviceUrl || !serviceRoleKey || !anonKey) {
    return { error: json(500, { error: 'missing_env' }) };
  }

  const authHeader = request.headers.get('authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return { error: json(401, { error: 'missing_auth_token' }) };
  }

  const userClient = createClient(serviceUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    }
  });
  const service = createClient(serviceUrl, serviceRoleKey);
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);

  if (userError || !userData.user?.email) {
    return { error: json(401, { error: 'invalid_auth_token' }) };
  }

  const email = userData.user.email.toLowerCase();
  const { data: adminRow } = await service
    .from('admin_users')
    .select('email,name,role,status')
    .eq('email', email)
    .maybeSingle();

  const admin = adminRow as AdminUser | null;
  if (!admin || admin.status !== 'active') {
    return { error: json(403, { error: 'admin_forbidden' }) };
  }

  return { service, admin, user: userData.user };
}

async function getOverview(service: SupabaseService) {
  const todayStart = getShanghaiDayStart(0).toISOString();
  const trendStart = getShanghaiDayStart(-6).toISOString();
  const trends = createTrendSkeleton();

  const [
    totalUsers,
    todayUsers,
    restrictedUsers,
    bannedUsers,
    deletedUsers,
    totalNotices,
    pendingNotices,
    publishedNotices,
    rejectedNotices,
    hiddenNotices,
    deletedNotices,
    todayNotices,
    totalOffers,
    pendingOffers,
    approvedOffers,
    hiddenOffers,
    deletedOffers,
    todayOffers,
    totalApplications,
    todayApplications,
    totalFeedback,
    pendingFeedback,
    processingFeedback,
    resolvedFeedback,
    closedFeedback
  ] = await Promise.all([
    countRows(service.from('profiles').select('id', { count: 'exact', head: true })),
    countRows(service.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart)),
    countRows(service.from('user_moderation').select('user_id', { count: 'exact', head: true }).eq('status', 'restricted')),
    countRows(service.from('user_moderation').select('user_id', { count: 'exact', head: true }).eq('status', 'banned')),
    countRows(service.from('user_moderation').select('user_id', { count: 'exact', head: true }).eq('status', 'deleted')),
    countRows(service.from('notices').select('id', { count: 'exact', head: true }).is('admin_deleted_at', null)),
    countRows(service.from('notices').select('id', { count: 'exact', head: true }).is('admin_deleted_at', null).eq('admin_status', 'pending')),
    countRows(service.from('notices').select('id', { count: 'exact', head: true }).is('admin_deleted_at', null).eq('admin_status', 'published')),
    countRows(service.from('notices').select('id', { count: 'exact', head: true }).is('admin_deleted_at', null).eq('admin_status', 'rejected')),
    countRows(service.from('notices').select('id', { count: 'exact', head: true }).is('admin_deleted_at', null).eq('admin_status', 'hidden')),
    countRows(service.from('notices').select('id', { count: 'exact', head: true }).not('admin_deleted_at', 'is', null)),
    countRows(service.from('notices').select('id', { count: 'exact', head: true }).gte('created_at', todayStart)),
    countRows(service.from('offer_posts').select('id', { count: 'exact', head: true }).is('deleted_at', null)),
    countRows(service.from('offer_posts').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('review_status', 'pending')),
    countRows(service.from('offer_posts').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('review_status', 'approved')),
    countRows(service.from('offer_posts').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('review_status', 'hidden')),
    countRows(service.from('offer_posts').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null)),
    countRows(service.from('offer_posts').select('id', { count: 'exact', head: true }).gte('created_at', todayStart)),
    countRows(service.from('applications').select('id', { count: 'exact', head: true })),
    countRows(service.from('applications').select('id', { count: 'exact', head: true }).gte('created_at', todayStart)),
    countRows(service.from('feedback_reports').select('id', { count: 'exact', head: true })),
    countRows(service.from('feedback_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    countRows(service.from('feedback_reports').select('id', { count: 'exact', head: true }).eq('status', 'processing')),
    countRows(service.from('feedback_reports').select('id', { count: 'exact', head: true }).eq('status', 'resolved')),
    countRows(service.from('feedback_reports').select('id', { count: 'exact', head: true }).eq('status', 'closed'))
  ]);

  const [profileTrend, noticeTrend, offerTrend, applicationTrend] = await Promise.all([
    service.from('profiles').select('created_at').gte('created_at', trendStart),
    service.from('notices').select('created_at').gte('created_at', trendStart),
    service.from('offer_posts').select('created_at').gte('created_at', trendStart),
    service.from('applications').select('created_at').gte('created_at', trendStart)
  ]);

  if (profileTrend.error) throw profileTrend.error;
  if (noticeTrend.error) throw noticeTrend.error;
  if (offerTrend.error) throw offerTrend.error;
  if (applicationTrend.error) throw applicationTrend.error;

  for (const row of profileTrend.data || []) incrementTrend(trends, row.created_at, 'users');
  for (const row of noticeTrend.data || []) incrementTrend(trends, row.created_at, 'notices');
  for (const row of offerTrend.data || []) incrementTrend(trends, row.created_at, 'offers');
  for (const row of applicationTrend.data || []) incrementTrend(trends, row.created_at, 'applications');

  return {
    metrics: {
      totalUsers,
      todayUsers,
      normalUsers: Math.max(totalUsers - restrictedUsers - bannedUsers - deletedUsers, 0),
      restrictedUsers,
      bannedUsers,
      deletedUsers,
      totalNotices,
      pendingNotices,
      publishedNotices,
      rejectedNotices,
      hiddenNotices,
      deletedNotices,
      todayNotices,
      totalOffers,
      pendingOffers,
      approvedOffers,
      hiddenOffers,
      deletedOffers,
      todayOffers,
      totalApplications,
      todayApplications,
      totalFeedback,
      pendingFeedback,
      processingFeedback,
      resolvedFeedback,
      closedFeedback
    },
    trends: trends.map(({ date, users, notices, offers, applications }) => ({ date, users, notices, offers, applications }))
  };
}

async function getNoticeMetrics(service: SupabaseService) {
  const [pending, published, rejected, hidden, deleted] = await Promise.all([
    countRows(service.from('notices').select('id', { count: 'exact', head: true }).is('admin_deleted_at', null).eq('admin_status', 'pending')),
    countRows(service.from('notices').select('id', { count: 'exact', head: true }).is('admin_deleted_at', null).eq('admin_status', 'published')),
    countRows(service.from('notices').select('id', { count: 'exact', head: true }).is('admin_deleted_at', null).eq('admin_status', 'rejected')),
    countRows(service.from('notices').select('id', { count: 'exact', head: true }).is('admin_deleted_at', null).eq('admin_status', 'hidden')),
    countRows(service.from('notices').select('id', { count: 'exact', head: true }).not('admin_deleted_at', 'is', null))
  ]);

  return { pending, published, rejected, hidden, deleted };
}

async function listNotices(service: SupabaseService, body: Record<string, unknown>) {
  const page = readPage(body);
  const pageSize = readPageSize(body);
  const filters = readFilters(body);
  const sort = String(body.sort || 'publish_desc');
  const status = normalizeFilter(filters.status);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = service
    .from('notices')
    .select(
      'id,school_name,department_name,project_name,project_type,source_link,apply_link,publish_date,deadline_date,requirements,remarks,status,is_verified,last_checked_at,admin_status,is_private,created_at,updated_at_ts,admin_reviewed_by,admin_reviewed_at,admin_review_note,admin_deleted_at',
      { count: 'exact' }
    );

  if (status === 'deleted') {
    query = query.not('admin_deleted_at', 'is', null);
  } else {
    query = query.is('admin_deleted_at', null);
    if (status && status !== 'all') {
      query = query.eq('admin_status', mapNoticeStatus(status));
    }
  }

  if (normalizeFilter(filters.query)) {
    const pattern = likePattern(filters.query);
    query = query.or(`project_name.ilike.${pattern},school_name.ilike.${pattern},department_name.ilike.${pattern}`);
  }

  if (normalizeFilter(filters.school)) {
    query = query.ilike('school_name', likePattern(filters.school));
  }

  if (normalizeFilter(filters.type) && normalizeFilter(filters.type) !== 'all') {
    query = query.eq('project_type', normalizeFilter(filters.type));
  }

  if (normalizeFilter(filters.dateFrom)) {
    query = query.gte('publish_date', normalizeFilter(filters.dateFrom));
  }

  if (normalizeFilter(filters.dateTo)) {
    query = query.lte('publish_date', normalizeFilter(filters.dateTo));
  }

  if (sort === 'deadline_asc') {
    query = query.order('deadline_date', { ascending: true, nullsFirst: false });
  } else if (sort === 'updated_desc') {
    query = query.order('updated_at_ts', { ascending: false, nullsFirst: false });
  } else {
    query = query.order('publish_date', { ascending: false, nullsFirst: false });
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    notices: data || [],
    total: count || 0,
    page,
    pageSize,
    metrics: await getNoticeMetrics(service)
  };
}

async function updateNoticeStatus(service: SupabaseService, admin: AdminUser, request: Request, ids: string[], status: string, note: string) {
  const validIds = ids.map((item) => String(item || '').trim()).filter(Boolean);
  if (!validIds.length) {
    throw new Error('no_notice_ids');
  }

  const nextStatus = requireOneOf(status, ['published', 'pending', 'rejected', 'hidden', 'deleted'], 'notice_status');
  const before = await service.from('notices').select('*').in('id', validIds);
  if (before.error) throw before.error;
  const now = new Date();
  const nowIso = now.toISOString();
  const nowText = nowIso.slice(0, 10);

  const patch = {
    admin_status: nextStatus,
    is_private: nextStatus !== 'published',
    admin_deleted_at: nextStatus === 'deleted' ? nowIso : null,
    admin_reviewed_by: admin.email,
    admin_reviewed_at: nowIso,
    admin_review_note: note,
    updated_at_ts: nowIso,
    updated_at: nowText,
    last_checked_at: nowText,
    is_verified: nextStatus === 'published'
  };

  const { data, error } = await service.from('notices').update(patch).in('id', validIds).select();
  if (error) throw error;

  await logOperation(service, admin, request, validIds.length > 1 ? 'bulk_update_notice_status' : 'update_notice_status', 'notices', validIds.join(','), before.data, data, note);
  return { notices: data || [], count: data?.length || 0 };
}

async function getOfferMetrics(service: SupabaseService) {
  const [pending, approved, hidden, rejected, deleted] = await Promise.all([
    countRows(service.from('offer_posts').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('review_status', 'pending')),
    countRows(service.from('offer_posts').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('review_status', 'approved')),
    countRows(service.from('offer_posts').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('review_status', 'hidden')),
    countRows(service.from('offer_posts').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('review_status', 'rejected')),
    countRows(service.from('offer_posts').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null))
  ]);

  return { pending, approved, hidden, rejected, deleted };
}

async function listOffers(service: SupabaseService, body: Record<string, unknown>) {
  const page = readPage(body);
  const pageSize = readPageSize(body);
  const filters = readFilters(body);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = service
    .from('offer_posts')
    .select('id,author_name,school_name,major,project_type,result,undergraduate_background,is_anonymous,review_status,reports_count,created_at', { count: 'exact' });

  const status = normalizeFilter(filters.status);
  if (status === 'deleted') {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
    if (status && status !== 'all') {
      query = query.eq('review_status', mapOfferStatus(status));
    }
  }

  if (normalizeFilter(filters.query)) {
    const pattern = likePattern(filters.query);
    query = query.or(`author_name.ilike.${pattern},school_name.ilike.${pattern},major.ilike.${pattern},result.ilike.${pattern}`);
  }

  if (normalizeFilter(filters.school)) {
    query = query.ilike('school_name', likePattern(filters.school));
  }

  if (normalizeFilter(filters.major)) {
    query = query.ilike('major', likePattern(filters.major));
  }

  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);

  if (error) throw error;
  return { offers: data || [], total: count || 0, page, pageSize, metrics: await getOfferMetrics(service) };
}

async function fetchAuthEmails(service: SupabaseService, userIds: string[]) {
  const emailById = new Map<string, string>();
  try {
    const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const user of data.users || []) {
      if (userIds.includes(user.id)) {
        emailById.set(user.id, user.email || '');
      }
    }
  } catch {
    // Auth Admin API is not required for the admin list to work.
  }
  return emailById;
}

async function getUserMetrics(service: SupabaseService) {
  const todayStart = getShanghaiDayStart(0).toISOString();
  const [totalUsers, todayUsers, restrictedUsers, bannedUsers, deletedUsers] = await Promise.all([
    countRows(service.from('profiles').select('id', { count: 'exact', head: true })),
    countRows(service.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart)),
    countRows(service.from('user_moderation').select('user_id', { count: 'exact', head: true }).eq('status', 'restricted')),
    countRows(service.from('user_moderation').select('user_id', { count: 'exact', head: true }).eq('status', 'banned')),
    countRows(service.from('user_moderation').select('user_id', { count: 'exact', head: true }).eq('status', 'deleted'))
  ]);

  return {
    totalUsers,
    todayUsers,
    normalUsers: Math.max(totalUsers - restrictedUsers - bannedUsers - deletedUsers, 0),
    restrictedUsers,
    bannedUsers,
    deletedUsers
  };
}

async function listUsers(service: SupabaseService, body: Record<string, unknown>) {
  const page = readPage(body);
  const pageSize = readPageSize(body);
  const filters = readFilters(body);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const keyword = normalizeFilter(filters.query);
  const userId = normalizeFilter(filters.userId);
  const status = normalizeFilter(filters.status);
  const activity = normalizeFilter(filters.activity);

  let query = service
    .from('profiles')
    .select('id,nickname,undergraduate_school,major,target_major,created_at,updated_at', { count: 'exact' });

  if (userId) {
    query = query.ilike('id', likePattern(userId));
  }

  if (status && status !== 'all') {
    const moderationQuery = await service
      .from('user_moderation')
      .select('user_id,status')
      .neq('status', 'active');
    if (moderationQuery.error) throw moderationQuery.error;
    const moderatedRows = moderationQuery.data || [];
    const moderatedIds = moderatedRows.map((item) => item.user_id).filter(Boolean);
    if (status === 'active') {
      if (moderatedIds.length) {
        query = query.not('id', 'in', `(${moderatedIds.join(',')})`);
      }
    } else {
      const matchedIds = moderatedRows
        .filter((item) => item.status === status)
        .map((item) => item.user_id)
        .filter(Boolean);
      if (!matchedIds.length) {
        return {
          users: [],
          total: 0,
          page,
          pageSize,
          metrics: await getUserMetrics(service)
        };
      }
      query = query.in('id', matchedIds);
    }
  }

  if (activity && activity !== 'all') {
    const now = new Date();
    const offsetDays = activity === 'today' ? 0 : activity === '7d' ? -6 : activity === '30d' ? -29 : 0;
    const since = activity === 'today' ? getShanghaiDayStart(0).toISOString() : new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('updated_at', since);
  }

  if (keyword.includes('@')) {
    const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matchedUserIds = (data.users || [])
      .filter((user) => (user.email || '').toLowerCase().includes(keyword.toLowerCase()))
      .map((user) => user.id);
    if (!matchedUserIds.length) {
      return {
        users: [],
        total: 0,
        page,
        pageSize,
        metrics: await getUserMetrics(service)
      };
    }
    query = query.in('id', matchedUserIds);
  } else if (keyword) {
    const pattern = likePattern(keyword);
    query = query.or(`nickname.ilike.${pattern},undergraduate_school.ilike.${pattern},major.ilike.${pattern},target_major.ilike.${pattern}`);
  }

  const { data, error, count } = await query.order('updated_at', { ascending: false }).range(from, to);
  if (error) throw error;

  const userIds = (data || []).map((item) => item.id);
  const [applicationRows, moderationRows, noticeRows, offerRows, emailById] = await Promise.all([
    userIds.length ? service.from('applications').select('user_id,id').in('user_id', userIds) : Promise.resolve({ data: [] }),
    userIds.length ? service.from('user_moderation').select('user_id,status,note,updated_by,updated_at').in('user_id', userIds) : Promise.resolve({ data: [] }),
    userIds.length ? service.from('notices').select('created_by,id').in('created_by', userIds) : Promise.resolve({ data: [] }),
    userIds.length ? service.from('offer_posts').select('user_id,id').in('user_id', userIds) : Promise.resolve({ data: [] }),
    fetchAuthEmails(service, userIds)
  ]);

  const countByUser = (rows: Array<{ user_id?: string | null; created_by?: string | null }>, key: 'user_id' | 'created_by') => {
    const map = new Map<string, number>();
    for (const row of rows || []) {
      const id = row[key];
      if (id) map.set(id, (map.get(id) || 0) + 1);
    }
    return map;
  };

  const applicationCountByUser = countByUser((applicationRows.data || []) as Array<{ user_id?: string }>, 'user_id');
  const noticeCountByUser = countByUser((noticeRows.data || []) as Array<{ created_by?: string }>, 'created_by');
  const offerCountByUser = countByUser((offerRows.data || []) as Array<{ user_id?: string }>, 'user_id');
  const moderationByUser = new Map<string, { status: string; note: string }>();
  for (const row of moderationRows.data || []) {
    moderationByUser.set(row.user_id, { status: row.status, note: row.note });
  }

  return {
    users: (data || []).map((item) => ({
      ...item,
      email: emailById.get(item.id) || '',
      application_count: applicationCountByUser.get(item.id) || 0,
      notice_count: noticeCountByUser.get(item.id) || 0,
      offer_count: offerCountByUser.get(item.id) || 0,
      moderation_status: moderationByUser.get(item.id)?.status || 'active',
      moderation_note: moderationByUser.get(item.id)?.note || ''
    })),
    total: count || 0,
    page,
    pageSize,
    metrics: await getUserMetrics(service)
  };
}

async function listFeedback(service: SupabaseService, body: Record<string, unknown>) {
  const page = readPage(body);
  const pageSize = readPageSize(body);
  const filters = readFilters(body);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const type = normalizeFilter(filters.type);
  const module = normalizeFilter(filters.module);
  const status = normalizeFilter(filters.status);
  const queryText = normalizeFilter(filters.query);

  let query = service
    .from('feedback_reports')
    .select('id,type,module,target_id,content,status,handler,created_at,handled_at', { count: 'exact' });

  if (type && type !== 'all') {
    query = query.eq('type', type);
  }

  if (module && module !== 'all') {
    query = query.eq('module', module);
  }

  if (status && status !== 'all') {
    query = query.eq('status', mapFeedbackStatus(status));
  }

  if (queryText) {
    const pattern = likePattern(queryText);
    query = query.or(`content.ilike.${pattern},target_id.ilike.${pattern},handler.ilike.${pattern}`);
  }

  if (normalizeFilter(filters.dateFrom)) {
    query = query.gte('created_at', `${normalizeFilter(filters.dateFrom)}T00:00:00+08:00`);
  }

  if (normalizeFilter(filters.dateTo)) {
    query = query.lte('created_at', `${normalizeFilter(filters.dateTo)}T23:59:59+08:00`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const [pending, processing, resolved, closed] = await Promise.all([
    countRows(service.from('feedback_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    countRows(service.from('feedback_reports').select('id', { count: 'exact', head: true }).eq('status', 'processing')),
    countRows(service.from('feedback_reports').select('id', { count: 'exact', head: true }).eq('status', 'resolved')),
    countRows(service.from('feedback_reports').select('id', { count: 'exact', head: true }).eq('status', 'closed'))
  ]);

  return { feedback: data || [], total: count || 0, page, pageSize, metrics: { pending, processing, resolved, closed } };
}

async function listAiWaitlistLeads(service: SupabaseService, body: Record<string, unknown>) {
  const page = readPage(body);
  const pageSize = readPageSize(body);
  const filters = readFilters(body);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const keyword = normalizeFilter(filters.query);
  const primaryNeed = normalizeFilter(filters.primaryNeed);
  const todayStart = getShanghaiDayStart(0).toISOString();

  let query = service
    .from('ai_waitlist_leads')
    .select('id,user_id,wechat_id,primary_need,details,submitted_at_text,source,created_at', { count: 'exact' });

  if (keyword) {
    const pattern = likePattern(keyword);
    query = query.or(`wechat_id.ilike.${pattern},primary_need.ilike.${pattern},details.ilike.${pattern}`);
  }

  if (primaryNeed && primaryNeed !== '全部需求') {
    query = query.eq('primary_need', primaryNeed);
  }

  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;

  const [totalLeads, todayLeads, riskLeads, materialLeads, briefLeads] = await Promise.all([
    countRows(service.from('ai_waitlist_leads').select('id', { count: 'exact', head: true })),
    countRows(service.from('ai_waitlist_leads').select('id', { count: 'exact', head: true }).gte('created_at', todayStart)),
    countRows(service.from('ai_waitlist_leads').select('id', { count: 'exact', head: true }).eq('primary_need', '申请风险评估')),
    countRows(service.from('ai_waitlist_leads').select('id', { count: 'exact', head: true }).eq('primary_need', '材料短板提示')),
    countRows(service.from('ai_waitlist_leads').select('id', { count: 'exact', head: true }).eq('primary_need', '提炼简章要求'))
  ]);

  return {
    aiWaitlistLeads: data || [],
    total: count || 0,
    page,
    pageSize,
    metrics: {
      totalLeads,
      todayLeads,
      riskLeads,
      materialLeads,
      briefLeads
    }
  };
}

async function listLogs(service: SupabaseService, body: Record<string, unknown>) {
  const page = readPage(body);
  const pageSize = readPageSize(body);
  const filters = readFilters(body);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const todayStart = getShanghaiDayStart(0).toISOString();
  const operator = normalizeFilter(filters.operator);
  const action = normalizeFilter(filters.action);
  const module = normalizeFilter(filters.module);
  const queryText = normalizeFilter(filters.query);

  let query = service
    .from('admin_operation_logs')
    .select('id,admin_email,action,module,target_id,ip_address,result,remark,created_at', { count: 'exact' });

  if (operator && operator !== 'all') {
    query = query.ilike('admin_email', likePattern(operator));
  }

  if (action && action !== 'all') {
    query = query.ilike('action', likePattern(action));
  }

  if (module && module !== 'all') {
    query = query.ilike('module', likePattern(module));
  }

  if (queryText) {
    const pattern = likePattern(queryText);
    query = query.or(`target_id.ilike.${pattern},remark.ilike.${pattern},ip_address.ilike.${pattern}`);
  }

  if (normalizeFilter(filters.dateFrom)) {
    query = query.gte('created_at', `${normalizeFilter(filters.dateFrom)}T00:00:00+08:00`);
  }

  if (normalizeFilter(filters.dateTo)) {
    query = query.lte('created_at', `${normalizeFilter(filters.dateTo)}T23:59:59+08:00`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const [todayOperations, deleteOperations, banOperations, failedOperations] = await Promise.all([
    countRows(service.from('admin_operation_logs').select('id', { count: 'exact', head: true }).gte('created_at', todayStart)),
    countRows(service.from('admin_operation_logs').select('id', { count: 'exact', head: true }).ilike('action', '%delete%')),
    countRows(service.from('admin_operation_logs').select('id', { count: 'exact', head: true }).ilike('action', '%user_status%')),
    countRows(service.from('admin_operation_logs').select('id', { count: 'exact', head: true }).eq('result', 'failed'))
  ]);

  return { logs: data || [], total: count || 0, page, pageSize, metrics: { todayOperations, deleteOperations, banOperations, failedOperations } };
}

async function listSettings(service: SupabaseService) {
  const { data, error } = await service
    .from('admin_system_settings')
    .select('key,value,description,updated_by,updated_at')
    .order('key', { ascending: true });

  if (error) throw error;
  return { settings: data || [] };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders() });
  }

  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const auth = await requireAdmin(request);
  if ('error' in auth) {
    return auth.error;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const { service, admin } = auth;
  const resource = String(body.resource || '');
  const action = String(body.action || 'list');
  const id = String(body.id || '');

  try {
    if (resource === 'me') {
      return json(200, { admin });
    }

    if (resource === 'overview') {
      requireAdminPermission(admin, 'overview:read');
      return json(200, await getOverview(service));
    }

    if (resource === 'analytics') {
      requireAdminPermission(admin, 'overview:read');
      return json(200, await getAnalyticsOverview(service));
    }

    if (resource === 'notices' && action === 'list') {
      requireAdminPermission(admin, 'content:write');
      return json(200, await listNotices(service, body));
    }

    if (resource === 'notices' && action === 'create') {
      requireAdminPermission(admin, 'content:write');
      const notice = body.notice as Record<string, unknown>;
      const nowText = new Date().toISOString().slice(0, 10);
      const payload = {
        id: String(notice.id || crypto.randomUUID()),
        school_name: String(notice.school_name || '').trim(),
        department_name: String(notice.department_name || '').trim(),
        project_name: String(notice.project_name || '').trim(),
        project_type: String(notice.project_type || '其他').trim(),
        discipline: String(notice.discipline || '').trim(),
        publish_date: String(notice.publish_date || nowText).trim(),
        deadline_date: String(notice.deadline_date || '').trim(),
        apply_link: String(notice.apply_link || '').trim(),
        source_link: String(notice.source_link || '').trim(),
        requirements: String(notice.requirements || '').trim(),
        materials_required: [],
        status: String(notice.status || '待审核').trim(),
        year: Number(notice.year || 2026),
        deadline_level: String(notice.deadline_level || 'future'),
        source_site: 'admin-manual',
        is_verified: true,
        admin_status: 'pending',
        is_private: true,
        updated_at: nowText,
        last_checked_at: nowText
      };
      const { data, error } = await service.from('notices').insert(payload).select().single();
      if (error) throw error;
      await logOperation(service, admin, request, 'create_notice', 'notices', payload.id, {}, data, '管理员新建通知');
      return json(200, { notice: data });
    }

    if (resource === 'notices' && (action === 'update_status' || action === 'bulk_update_status')) {
      requireAdminPermission(admin, 'content:write');
      const ids = action === 'bulk_update_status' ? ((body.ids || []) as string[]) : [id];
      return json(200, await updateNoticeStatus(service, admin, request, ids, String(body.status || 'published'), String(body.note || '')));
    }

    if (resource === 'offers' && action === 'list') {
      requireAdminPermission(admin, 'content:write');
      return json(200, await listOffers(service, body));
    }

    if (resource === 'offers' && action === 'update_status') {
      requireAdminPermission(admin, 'content:write');
      const nextStatus = requireOneOf(body.status, ['approved', 'rejected', 'hidden', 'deleted'], 'offer_status');
      const before = await service.from('offer_posts').select('*').eq('id', id).maybeSingle();
      const patch = {
        review_status: nextStatus,
        hidden_at: nextStatus === 'hidden' ? new Date().toISOString() : null,
        deleted_at: nextStatus === 'deleted' ? new Date().toISOString() : null,
        reviewed_by: admin.email,
        reviewed_at: new Date().toISOString(),
        review_note: String(body.note || '')
      };
      const { data, error } = await service.from('offer_posts').update(patch).eq('id', id).select().single();
      if (error) throw error;
      await logOperation(service, admin, request, 'update_offer_status', 'offers', id, before.data, data, String(body.note || ''));
      return json(200, { offer: data });
    }

    if (resource === 'users') {
      requireAdminPermission(admin, 'users:write');
      if (action === 'update_status') {
        const status = requireOneOf(body.status, ['active', 'restricted', 'banned', 'deleted'], 'user_status');
        const before = await service.from('user_moderation').select('*').eq('user_id', id).maybeSingle();
        const { data, error } = await service
          .from('user_moderation')
          .upsert({
            user_id: id,
            status,
            note: String(body.note || ''),
            updated_by: admin.email,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        if (error) throw error;
        await logOperation(service, admin, request, 'update_user_status', 'users', id, before.data, data, String(body.note || ''));
        return json(200, { userModeration: data });
      }

      return json(200, await listUsers(service, body));
    }

    if (resource === 'feedback' && action === 'list') {
      requireAdminPermission(admin, 'users:write');
      return json(200, await listFeedback(service, body));
    }

    if (resource === 'feedback' && action === 'update_status') {
      requireAdminPermission(admin, 'users:write');
      const nextStatus = requireOneOf(body.status, ['pending', 'processing', 'resolved', 'closed'], 'feedback_status');
      const before = await service.from('feedback_reports').select('*').eq('id', id).maybeSingle();
      const patch = {
        status: nextStatus,
        handler: admin.email,
        handler_note: String(body.note || ''),
        handled_at: nextStatus === 'pending' ? null : new Date().toISOString()
      };
      const { data, error } = await service.from('feedback_reports').update(patch).eq('id', id).select().single();
      if (error) throw error;
      await logOperation(service, admin, request, 'update_feedback_status', 'feedback', id, before.data, data, String(body.note || ''));
      return json(200, { feedback: data });
    }

    if (resource === 'ai_waitlist' && action === 'list') {
      requireAdminPermission(admin, 'users:write');
      return json(200, await listAiWaitlistLeads(service, body));
    }

    if (resource === 'logs') {
      requireAdminPermission(admin, 'logs:read');
      return json(200, await listLogs(service, body));
    }

    if (resource === 'settings' && action === 'list') {
      requireAdminPermission(admin, 'settings:write');
      return json(200, await listSettings(service));
    }

    if (resource === 'settings' && action === 'update') {
      requireAdminPermission(admin, 'settings:write');
      const key = String(body.key || '');
      if (!allowedSettingKeys.has(key)) {
        throw new Error('invalid_setting_key');
      }
      const value = normalizeSettingValue(key, body.value);
      const before = await service.from('admin_system_settings').select('*').eq('key', key).maybeSingle();
      const { data, error } = await service
        .from('admin_system_settings')
        .upsert({ key, value, updated_by: admin.email, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        .select()
        .single();
      if (error) throw error;
      await logOperation(service, admin, request, 'update_setting', 'settings', key, before.data, data);
      return json(200, { setting: data });
    }

    return json(400, { error: 'unknown_resource_or_action' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'admin_permission_denied' ? 403 : message.startsWith('invalid_') || message === 'no_notice_ids' ? 400 : 500;

    return json(status, {
      error: 'admin_api_failed',
      message
    });
  }
});
