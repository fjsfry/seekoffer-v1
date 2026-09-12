import type {UserProjectRecord} from './mock-data';

const fields = {
  isFavorited: 'is_favorited', myStatus: 'my_status', priorityLevel: 'priority_level',
  materialsProgress: 'materials_progress', cvReady: 'cv_ready', transcriptReady: 'transcript_ready',
  rankingProofReady: 'ranking_proof_ready', recommendationReady: 'recommendation_ready',
  personalStatementReady: 'personal_statement_ready', contactSupervisorDone: 'contact_supervisor_done',
  submittedAt: 'submitted_at', interviewTime: 'interview_time', resultStatus: 'result_status',
  myNotes: 'my_notes', customReminderEnabled: 'custom_reminder_enabled'
} as const;

// Identity is checked by the caller. Send only explicit edits and derived fields,
// so retrying a note cannot rewrite an unrelated material or status field.
export function desktopApplicationPatch(record: UserProjectRecord, patch: Partial<UserProjectRecord>) {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    if (['userId', 'userProjectId', 'projectId'].includes(key)) continue;
    if (!Object.hasOwn(fields, key)) throw new Error('申请修改包含不支持的字段。');
    const field = key as keyof typeof fields;
    result[fields[field]] = record[field];
  }
  if (!Object.keys(result).length) throw new Error('申请修改没有可保存的字段。');
  return result;
}
