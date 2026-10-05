export const legacyApplicationFields=[
  ['isFavorited','is_favorited',true],['myStatus','my_status','已收藏'],['priorityLevel','priority_level','中'],
  ['materialsProgress','materials_progress',0],['cvReady','cv_ready',false],['transcriptReady','transcript_ready',false],
  ['rankingProofReady','ranking_proof_ready',false],['recommendationReady','recommendation_ready',false],
  ['personalStatementReady','personal_statement_ready',false],['contactSupervisorDone','contact_supervisor_done',false],
  ['submittedAt','submitted_at',''],['interviewTime','interview_time',''],['resultStatus','result_status','未出结果'],
  ['myNotes','my_notes',''],['customReminderEnabled','custom_reminder_enabled',true]
] as const;
export const legacyUuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const allowed=new Set(['userId','userProjectId','projectId',...legacyApplicationFields.map(f=>f[0])]);
function id(v:unknown){if(typeof v!=='string'||!v||v.length>180||/[\u0000-\u001f]/.test(v))throw Error('INVALID_LEGACY_ID');return v;}
export function normalizeLegacyApplication(value:unknown,owner:string){
  if(!legacyUuid.test(owner)||!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_LEGACY_RECORD');
  const row=value as Record<string,unknown>;if(Object.keys(row).some(k=>!allowed.has(k)))throw Error('UNSUPPORTED_LEGACY_FIELD');
  if(typeof row.userId!=='string'||row.userId.toLowerCase()!==owner.toLowerCase())throw Error('LEGACY_OWNER_MISMATCH');
  const sourceId=id(row.userProjectId),projectId=id(row.projectId),fields:Record<string,string|number|boolean>={},defaults:string[]=[];
  for(const [camel,column,fallback] of legacyApplicationFields){
    const v=row[camel]===undefined?fallback:row[camel];if(row[camel]===undefined)defaults.push(camel);
    if(typeof v!==typeof fallback)throw Error('INVALID_LEGACY_FIELD');
    if(typeof v==='string'&&(v.length>(camel==='myNotes'?20000:500)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)))throw Error('LEGACY_TEXT_REQUIRES_REVIEW');
    if(typeof v==='number'&&(!Number.isInteger(v)||v<0||v>100))throw Error('INVALID_LEGACY_PROGRESS');
    fields[column]=typeof v==='boolean'?(v?1:0):v as string|number;
  }
  return {sourceId,projectId,fields,defaults,fingerprint:JSON.stringify([projectId,fields])};
}
export function planLegacyApplications(records:Record<string,unknown>[],owner:string){
  const groups=new Map<string,{record:Record<string,unknown>;normalized:ReturnType<typeof normalizeLegacyApplication>;conflict:boolean}>();
  let invalid=0,duplicates=0;
  for(const record of records){try{const n=normalizeLegacyApplication(record,owner),prior=groups.get(n.projectId);
    if(!prior){groups.set(n.projectId,{record,normalized:n,conflict:false});continue;}
    if(prior.normalized.fingerprint!==n.fingerprint||(legacyUuid.test(prior.normalized.sourceId)&&legacyUuid.test(n.sourceId)&&prior.normalized.sourceId!==n.sourceId)){prior.conflict=true;continue;}
    duplicates++;if(legacyUuid.test(n.sourceId)&&!legacyUuid.test(prior.normalized.sourceId)){prior.record=record;prior.normalized=n;}
  }catch{invalid++;}}
  const entries=[...groups.values()];return {records:entries.filter(g=>!g.conflict).map(g=>g.record),conflicts:entries.filter(g=>g.conflict).length,invalid,duplicates,defaultedRecords:entries.filter(g=>g.normalized.defaults.length>0).length};
}
