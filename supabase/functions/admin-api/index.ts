import { createClient } from 'npm:@supabase/supabase-js@2';

type AdminUser = {
  email: string;
  name: string;
  role: string;
  status: string;
};

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

function toStatusText(value: unknown) {
  return String(value || '').trim();
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

async function logOperation(
  service: ReturnType<typeof createClient>,
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

async function getOverview(service: ReturnType<typeof createClient>) {
  const [
    noticesCount,
    pendingNoticesCount,
    applicationsCount,
    profilesCount,
    offersCount,
    pendingOffersCount,
    feedbackCount,
    pendingFeedbackCount
  ] = await Promise.all([
    service.from('notices').select('id', { count: 'exact', head: true }),
    service.from('notices').select('id', { count: 'exact', head: true }).eq('admin_status', 'pending'),
    service.from('applications').select('id', { count: 'exact', head: true }),
    service.from('profiles').select('id', { count: 'exact', head: true }),
    service.from('offer_posts').select('id', { count: 'exact', head: true }),
    service.from('offer_posts').select('id', { count: 'exact', head: true }).eq('review_status', 'pending'),
    service.from('feedback_reports').select('id', { count: 'exact', head: true }),
    service.from('feedback_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  ]);

  return {
    metrics: {
      totalUsers: profilesCount.count || 0,
      totalNotices: noticesCount.count || 0,
      pendingNotices: pendingNoticesCount.count || 0,
      totalOffers: offersCount.count || 0,
      pendingOffers: pendingOffersCount.count || 0,
      totalApplications: applicationsCount.count || 0,
      totalFeedback: feedbackCount.count || 0,
      pendingFeedback: pendingFeedbackCount.count || 0
    }
  };
}

async function listNotices(service: ReturnType<typeof createClient>) {
  const { data, error } = await service
    .from('notices')
    .select('id,school_name,department_name,project_name,project_type,source_link,publish_date,deadline_date,admin_status,is_private,created_at,updated_at_ts')
    .is('admin_deleted_at', null)
    .order('publish_date', { ascending: false })
    .limit(100);

  if (error) throw error;
  return { notices: data || [] };
}

async function listOffers(service: ReturnType<typeof createClient>) {
  const { data, error } = await service
    .from('offer_posts')
    .select('id,author_name,school_name,major,project_type,result,undergraduate_background,is_anonymous,review_status,reports_count,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return { offers: data || [] };
}

async function listUsers(service: ReturnType<typeof createClient>) {
  const { data, error } = await service
    .from('profiles')
    .select('id,nickname,undergraduate_school,major,target_major,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  const userIds = (data || []).map((item) => item.id);
  const { data: applicationRows } = userIds.length
    ? await service.from('applications').select('user_id,id').in('user_id', userIds)
    : { data: [] };
  const { data: moderationRows } = userIds.length
    ? await service.from('user_moderation').select('user_id,status,note,updated_by,updated_at').in('user_id', userIds)
    : { data: [] };

  const applicationCountByUser = new Map<string, number>();
  for (const row of applicationRows || []) {
    applicationCountByUser.set(row.user_id, (applicationCountByUser.get(row.user_id) || 0) + 1);
  }
  const moderationByUser = new Map<string, { status: string; note: string }>();
  for (const row of moderationRows || []) {
    moderationByUser.set(row.user_id, { status: row.status, note: row.note });
  }

  return {
    users: (data || []).map((item) => ({
      ...item,
      application_count: applicationCountByUser.get(item.id) || 0,
      moderation_status: moderationByUser.get(item.id)?.status || 'active',
      moderation_note: moderationByUser.get(item.id)?.note || ''
    }))
  };
}

async function listFeedback(service: ReturnType<typeof createClient>) {
  const { data, error } = await service
    .from('feedback_reports')
    .select('id,type,module,target_id,content,status,handler,created_at,handled_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return { feedback: data || [] };
}

async function listLogs(service: ReturnType<typeof createClient>) {
  const { data, error } = await service
    .from('admin_operation_logs')
    .select('id,admin_email,action,module,target_id,ip_address,result,remark,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return { logs: data || [] };
}

async function listSettings(service: ReturnType<typeof createClient>) {
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
      return json(200, await listNotices(service));
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
        updated_at: nowText,
        last_checked_at: nowText
      };
      const { data, error } = await service.from('notices').insert(payload).select().single();
      if (error) throw error;
      await logOperation(service, admin, request, 'create_notice', 'notices', payload.id, {}, data, '管理员新建通知');
      return json(200, { notice: data });
    }

    if (resource === 'notices' && action === 'update_status') {
      const nextStatus = mapNoticeStatus(String(body.status || 'published'));
      const before = await service.from('notices').select('*').eq('id', id).maybeSingle();
      const patch = {
        admin_status: nextStatus,
        is_private: nextStatus === 'hidden' || nextStatus === 'deleted',
        admin_deleted_at: nextStatus === 'deleted' ? new Date().toISOString() : null,
        admin_reviewed_by: admin.email,
        admin_reviewed_at: new Date().toISOString(),
        admin_review_note: String(body.note || '')
      };
      const { data, error } = await service.from('notices').update(patch).eq('id', id).select().single();
      if (error) throw error;
      await logOperation(service, admin, request, 'update_notice_status', 'notices', id, before.data, data, String(body.note || ''));
      return json(200, { notice: data });
    }

    if (resource === 'offers' && action === 'list') {
      return json(200, await listOffers(service));
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

      return json(200, await listUsers(service));
    }

    if (resource === 'feedback' && action === 'list') {
      return json(200, await listFeedback(service));
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
      return json(200, await listLogs(service));
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
