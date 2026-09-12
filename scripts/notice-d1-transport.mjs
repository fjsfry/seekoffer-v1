// Explicit boundary between public-source crawler metadata and D1 business columns.
const columns = new Set([
  'id','school_name','department_name','project_name','project_type','discipline',
  'publish_date','deadline_date','event_start_date','event_end_date','apply_link','source_link',
  'requirements','materials_required','exam_interview_info','contact_info','remarks','tags',
  'status','year','deadline_level','source_site','collected_at','updated_at','last_checked_at',
  'is_verified','change_log','history_records','admin_status','admin_review_note','is_private',
  'source_detail_complete'
]);
// These describe the acquisition, not source database columns. Reminder defaults
// must never reset previously sent reminders. Quality is retained in admin_*.
const acquisitionOnly = new Set(['source_record_id','last_checked_source','quality_tier',
  'quality_reasons','reminder_7d_sent','reminder_3d_sent','reminder_1d_sent']);
export function toD1Notice(notice) {
  if (!notice || Array.isArray(notice) || typeof notice !== 'object') throw Error('INVALID_NOTICE');
  for (const key of Object.keys(notice)) if (!columns.has(key) && !acquisitionOnly.has(key)) throw Error('UNMAPPED_CRAWLER_FIELD');
  if (typeof notice.id !== 'string' || !/^(baoyantongzhi-|baoyanwang-|xingke-|baoyannews-)/.test(notice.id)) throw Error('UNEXPECTED_CRAWLER_ID');
  const row=Object.fromEntries(Object.entries(notice).filter(([key]) => columns.has(key)));
  // A known source typo is retained for review, never automatically published.
  let corrected=false;
  for(const key of ['source_link','apply_link'])if(typeof row[key]==='string'&&row[key].startsWith('ttps://')){
    row[key]='h'+row[key];corrected=true;
  }
  if(corrected){row.admin_status='pending';row.is_private=true;row.admin_review_note=[row.admin_review_note,'auto_quality:source_url_scheme_typo'].filter(Boolean).join(';');}
  return row;
}
export function orderD1Notices(notices) {
  return notices.map(toD1Notice).sort((a,b) => String(b.publish_date).localeCompare(String(a.publish_date)) || a.id.localeCompare(b.id));
}
export function ingestionShouldRetry(status, code='') {
  if ([402,409].includes(status) || ['INGEST_DAILY_BUDGET','INGEST_CONFLICT_OR_DAILY_BUDGET'].includes(code)) return false;
  return [408,425,429].includes(status) || status >= 500 && status <= 599;
}
