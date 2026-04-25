import { createClient } from 'npm:@supabase/supabase-js@2';

type NoticePayload = {
  id: string | number;
  school_name?: string;
  department_name?: string;
  project_name?: string;
  project_type?: string;
  discipline?: string;
  publish_date?: string;
  deadline_date?: string;
  event_start_date?: string;
  event_end_date?: string;
  apply_link?: string;
  source_link?: string;
  requirements?: string;
  materials_required?: string[];
  exam_interview_info?: string;
  contact_info?: string;
  remarks?: string;
  tags?: string[];
  status?: string;
  year?: number;
  deadline_level?: string;
  source_site?: string;
  is_private?: boolean;
  collected_at?: string;
  updated_at?: string;
  last_checked_at?: string;
  is_verified?: boolean;
  change_log?: unknown[];
  history_records?: unknown[];
};

type IngestBody = {
  notices?: NoticePayload[];
  source?: string;
  summary?: Record<string, unknown>;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function normalizeNotice(notice: NoticePayload) {
  const nowText = new Date().toISOString().slice(0, 19).replace('T', ' ');

  return {
    id: String(notice.id),
    school_name: String(notice.school_name || '').trim(),
    department_name: String(notice.department_name || '').trim(),
    project_name: String(notice.project_name || '').trim(),
    project_type: String(notice.project_type || '').trim() || '夏令营',
    discipline: String(notice.discipline || '').trim(),
    publish_date: String(notice.publish_date || '').trim(),
    deadline_date: String(notice.deadline_date || '').trim(),
    event_start_date: String(notice.event_start_date || '').trim(),
    event_end_date: String(notice.event_end_date || '').trim(),
    apply_link: String(notice.apply_link || '').trim(),
    source_link: String(notice.source_link || '').trim(),
    requirements: String(notice.requirements || '').trim(),
    materials_required: Array.isArray(notice.materials_required) ? notice.materials_required : [],
    exam_interview_info: String(notice.exam_interview_info || '').trim(),
    contact_info: String(notice.contact_info || '').trim(),
    remarks: String(notice.remarks || '').trim(),
    tags: Array.isArray(notice.tags) ? notice.tags : [],
    status: String(notice.status || '').trim() || '报名中',
    year: Number(notice.year || 2026),
    deadline_level: String(notice.deadline_level || '').trim() || 'future',
    source_site: String(notice.source_site || '').trim() || 'CloudBase Spider',
    is_private: Boolean(notice.is_private),
    collected_at: String(notice.collected_at || '').trim() || nowText,
    updated_at: String(notice.updated_at || '').trim() || nowText,
    last_checked_at: String(notice.last_checked_at || '').trim() || nowText,
    is_verified: Boolean(notice.is_verified),
    change_log: Array.isArray(notice.change_log) ? notice.change_log : [],
    history_records: Array.isArray(notice.history_records) ? notice.history_records : []
  };
}

function dedupeNoticesById(notices: ReturnType<typeof normalizeNotice>[]) {
  const byId = new Map<string, ReturnType<typeof normalizeNotice>>();

  for (const notice of notices) {
    byId.set(notice.id, notice);
  }

  return Array.from(byId.values());
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const serviceUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const ingestSecret = Deno.env.get('SEEKOFFER_INGEST_SECRET') || '';

  if (!serviceUrl || !serviceRoleKey || !ingestSecret) {
    return json(500, { error: 'missing_env' });
  }

  const suppliedSecret =
    request.headers.get('x-seekoffer-ingest-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';

  if (suppliedSecret !== ingestSecret) {
    return json(401, { error: 'unauthorized' });
  }

  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const normalizedNotices = Array.isArray(body.notices) ? body.notices.map(normalizeNotice) : [];
  const notices = dedupeNoticesById(normalizedNotices);
  if (!notices.length) {
    return json(400, { error: 'empty_notices' });
  }

  const invalidNotice = notices.find((notice) => !notice.id || !notice.school_name || !notice.project_name);
  if (invalidNotice) {
    return json(400, {
      error: 'invalid_notice_payload',
      noticeId: invalidNotice.id
    });
  }

  const supabase = createClient(serviceUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { error: noticeError } = await supabase.from('notices').upsert(notices, {
    onConflict: 'id'
  });

  if (noticeError) {
    return json(500, {
      error: 'upsert_failed',
      detail: noticeError.message
    });
  }

  await supabase.from('crawler_runs').insert({
    source: body.source || 'cloudbase-sync',
    notices_received: notices.length,
    notices_upserted: notices.length,
    success: true,
    summary: body.summary || {}
  });

  return json(200, {
    ok: true,
    noticesReceived: normalizedNotices.length,
    noticesUpserted: notices.length
  });
});
