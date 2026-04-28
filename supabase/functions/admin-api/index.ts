import { createClient } from 'npm:@supabase/supabase-js@2';

type AdminUser = {
  email: string;
  name: string;
  role: string;
  status: string;
};

type SupabaseService = ReturnType<typeof createClient>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
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
  const allowedEmails = (Deno.env.get('SEEKOFFER_ADMIN_EMAILS') || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const { data: adminRow } = await service
    .from('admin_users')
    .select('email,name,role,status')
    .eq('email', email)
    .maybeSingle();

  const fallbackAdmin =
    !adminRow && allowedEmails.includes(email)
      ? {
          email,
          name: email.split('@')[0],
          role: 'super_admin',
          status: 'active'
        }
      : null;

  const admin = (adminRow || fallbackAdmin) as AdminUser | null;
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

  const nextStatus = mapNoticeStatus(status);
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

  let query = service
    .from('profiles')
    .select('id,nickname,undergraduate_school,major,target_major,created_at,updated_at', { count: 'exact' });

  if (userId) {
    query = query.ilike('id', likePattern(userId));
  }

  if (keyword) {
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
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await service
    .from('feedback_reports')
    .select('id,type,module,target_id,content,status,handler,created_at,handled_at', { count: 'exact' })
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

async function listLogs(service: SupabaseService, body: Record<string, unknown>) {
  const page = readPage(body);
  const pageSize = readPageSize(body);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const todayStart = getShanghaiDayStart(0).toISOString();

  const { data, error, count } = await service
    .from('admin_operation_logs')
    .select('id,admin_email,action,module,target_id,ip_address,result,remark,created_at', { count: 'exact' })
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
    return new Response('ok', { headers: corsHeaders });
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
      return json(200, await getOverview(service));
    }

    if (resource === 'notices' && action === 'list') {
      return json(200, await listNotices(service, body));
    }

    if (resource === 'notices' && action === 'create') {
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
      const ids = action === 'bulk_update_status' ? ((body.ids || []) as string[]) : [id];
      return json(200, await updateNoticeStatus(service, admin, request, ids, String(body.status || 'published'), String(body.note || '')));
    }

    if (resource === 'offers' && action === 'list') {
      return json(200, await listOffers(service, body));
    }

    if (resource === 'offers' && action === 'update_status') {
      const nextStatus = mapOfferStatus(String(body.status || 'approved'));
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
      if (action === 'update_status') {
        const status = String(body.status || 'active');
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
      return json(200, await listFeedback(service, body));
    }

    if (resource === 'feedback' && action === 'update_status') {
      const nextStatus = mapFeedbackStatus(String(body.status || 'resolved'));
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

    if (resource === 'logs') {
      return json(200, await listLogs(service, body));
    }

    if (resource === 'settings' && action === 'list') {
      return json(200, await listSettings(service));
    }

    if (resource === 'settings' && action === 'update') {
      const key = String(body.key || '');
      const value = body.value;
      const before = await service.from('admin_system_settings').select('*').eq('key', key).maybeSingle();
      const { data, error } = await service
        .from('admin_system_settings')
        .update({ value, updated_by: admin.email, updated_at: new Date().toISOString() })
        .eq('key', key)
        .select()
        .single();
      if (error) throw error;
      await logOperation(service, admin, request, 'update_setting', 'settings', key, before.data, data);
      return json(200, { setting: data });
    }

    return json(400, { error: 'unknown_resource_or_action' });
  } catch (error) {
    return json(500, {
      error: 'admin_api_failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
