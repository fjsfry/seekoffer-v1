import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const [, , noticesArg = '', workspaceArg = '', mappingArg = ''] = process.argv;

function usage() {
  console.log(
    [
      'Usage:',
      '  node ./scripts/import-cloudbase-export-to-supabase.mjs <notices.json> [workspace.json] [user-map.json]',
      '',
      'user-map.json format:',
      '  {',
      '    "cloudbase-user-id": "supabase-user-uuid"',
      '  }'
    ].join('\n')
  );
}

async function readJson(inputPath) {
  if (!inputPath) {
    return null;
  }

  const absolutePath = path.resolve(process.cwd(), inputPath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(raw);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeNotice(document, createdBy = null, isPrivate = false) {
  return {
    id: String(document.id || document._id || '').trim(),
    school_name: String(document.school_name || document.schoolName || '').trim(),
    department_name: String(document.department_name || document.departmentName || '').trim(),
    project_name: String(document.project_name || document.projectName || '').trim(),
    project_type: String(document.project_type || document.projectType || '').trim() || '夏令营',
    discipline: String(document.discipline || '').trim(),
    publish_date: String(document.publish_date || document.publishDate || '').trim(),
    deadline_date: String(document.deadline_date || document.deadlineDate || '').trim(),
    event_start_date: String(document.event_start_date || document.eventStartDate || '').trim(),
    event_end_date: String(document.event_end_date || document.eventEndDate || '').trim(),
    apply_link: String(document.apply_link || document.applyLink || '').trim(),
    source_link: String(document.source_link || document.sourceLink || '').trim(),
    requirements: String(document.requirements || '').trim(),
    materials_required: ensureArray(document.materials_required || document.materialsRequired),
    exam_interview_info: String(document.exam_interview_info || document.examInterviewInfo || '').trim(),
    contact_info: String(document.contact_info || document.contactInfo || '').trim(),
    remarks: String(document.remarks || '').trim(),
    tags: ensureArray(document.tags),
    status: String(document.status || '').trim() || '报名中',
    year: Number(document.year || 2026),
    deadline_level: String(document.deadline_level || document.deadlineLevel || '').trim() || 'future',
    source_site: String(document.source_site || document.sourceSite || '').trim(),
    is_private: Boolean(isPrivate || document.is_private),
    collected_at: String(document.created_at || document.collectedAt || '').trim(),
    updated_at: String(document.updated_at || document.updatedAt || '').trim(),
    last_checked_at: String(document.last_checked_at || document.lastCheckedAt || '').trim(),
    is_verified: Boolean(document.is_verified ?? document.isVerified),
    change_log: ensureArray(document.change_log || document.changeLog),
    history_records: ensureArray(document.history_records || document.historyRecords),
    created_by: createdBy
  };
}

function normalizeProfile(profile, userId) {
  return {
    id: userId,
    nickname: String(profile?.nickname || '').trim(),
    age: String(profile?.age || '').trim(),
    undergraduate_school: String(profile?.undergraduateSchool || '').trim(),
    major: String(profile?.major || '').trim(),
    grade: String(profile?.grade || '').trim() || '大四',
    target_major: String(profile?.targetMajor || '').trim(),
    target_region: String(profile?.targetRegion || '').trim()
  };
}

function normalizeApplication(application, userId, projectIdMap) {
  const projectId = String(application.projectId || '').trim();
  if (!projectId || !projectIdMap.has(projectId)) {
    return null;
  }

  return {
    user_id: userId,
    project_id: projectId,
    is_favorited: Boolean(application.isFavorited ?? true),
    my_status: String(application.myStatus || '').trim() || '已收藏',
    priority_level: String(application.priorityLevel || '').trim() || '中',
    materials_progress: Number(application.materialsProgress || 0),
    cv_ready: Boolean(application.cvReady),
    transcript_ready: Boolean(application.transcriptReady),
    ranking_proof_ready: Boolean(application.rankingProofReady),
    recommendation_ready: Boolean(application.recommendationReady),
    personal_statement_ready: Boolean(application.personalStatementReady),
    contact_supervisor_done: Boolean(application.contactSupervisorDone),
    submitted_at: String(application.submittedAt || '').trim(),
    interview_time: String(application.interviewTime || '').trim(),
    result_status: String(application.resultStatus || '').trim() || '未出结果',
    my_notes: String(application.myNotes || '').trim(),
    custom_reminder_enabled: Boolean(application.customReminderEnabled ?? true)
  };
}

async function main() {
  if (!noticesArg) {
    usage();
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const noticesJson = await readJson(noticesArg);
  const workspaceJson = await readJson(workspaceArg);
  const userMap = (await readJson(mappingArg)) || {};
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const noticeRows = ensureArray(noticesJson).map((item) => normalizeNotice(item)).filter((item) => item.id);
  const { error: noticesError } = await supabase.from('notices').upsert(noticeRows, {
    onConflict: 'id'
  });
  if (noticesError) {
    throw noticesError;
  }

  const projectIdMap = new Set(noticeRows.map((item) => item.id));
  let skippedWorkspaceUsers = 0;
  let migratedProfiles = 0;
  let migratedApplications = 0;
  let migratedManualProjects = 0;
  let migratedWaitlistLeads = 0;

  for (const workspace of ensureArray(workspaceJson)) {
    const mappedUserId = userMap[String(workspace.userId || '')];
    if (!mappedUserId) {
      skippedWorkspaceUsers += 1;
      continue;
    }

    const profileRow = normalizeProfile(workspace.profile, mappedUserId);
    const { error: profileError } = await supabase.from('profiles').upsert(profileRow, {
      onConflict: 'id'
    });
    if (profileError) {
      throw profileError;
    }
    migratedProfiles += 1;

    const manualProjects = ensureArray(workspace.manualProjects).map((item) =>
      normalizeNotice(item, mappedUserId, true)
    );
    if (manualProjects.length) {
      const { error: manualError } = await supabase.from('notices').upsert(manualProjects, {
        onConflict: 'id'
      });
      if (manualError) {
        throw manualError;
      }

      manualProjects.forEach((item) => projectIdMap.add(item.id));
      migratedManualProjects += manualProjects.length;
    }

    const applicationRows = ensureArray(workspace.applications)
      .map((item) => normalizeApplication(item, mappedUserId, projectIdMap))
      .filter(Boolean);

    if (applicationRows.length) {
      const { error: applicationError } = await supabase.from('applications').upsert(applicationRows, {
        onConflict: 'user_id,project_id'
      });
      if (applicationError) {
        throw applicationError;
      }
      migratedApplications += applicationRows.length;
    }

    if (workspace.aiWaitlistLead?.wechatId) {
      const { error: waitlistError } = await supabase.from('ai_waitlist_leads').insert({
        user_id: mappedUserId,
        wechat_id: String(workspace.aiWaitlistLead.wechatId || '').trim(),
        primary_need: String(workspace.aiWaitlistLead.primaryNeed || '').trim(),
        details: String(workspace.aiWaitlistLead.details || '').trim(),
        submitted_at_text: String(workspace.aiWaitlistLead.submittedAt || '').trim(),
        source: String(workspace.aiWaitlistLead.source || 'cloudbase-workspace').trim()
      });
      if (waitlistError) {
        throw waitlistError;
      }
      migratedWaitlistLeads += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        notices: noticeRows.length,
        migratedProfiles,
        migratedApplications,
        migratedManualProjects,
        migratedWaitlistLeads,
        skippedWorkspaceUsers
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
