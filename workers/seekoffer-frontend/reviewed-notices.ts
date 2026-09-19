import snapshot from '../../artifacts/notice-read-repair-20260911/reviewed-index.json';
import {ApiError} from '../seekoffer-api/src/auth';
import {noticeSql} from '../seekoffer-api/src/notice-sql';
import {liveSummary,type NoticeProjection as P} from '../seekoffer-api/src/notice-projection';
import {getDisplaySchoolName} from '../../lib/notice-display';
import {getNoticeRegionOptions} from '../../lib/notice-analytics';
import type {PublicNoticeProject} from '../../lib/mock-data';
import {publicOutageActive} from './notice-outage-window';

const DAY=86400000,collator=new Intl.Collator('zh-CN');
const lex=(a:string,b:string)=>a<b?-1:a>b?1:0;
const base=snapshot.projections as P[];
export class ReviewedIndex {
 readonly rows:P[];readonly byId:Map<string,P>;readonly orders:Record<string,P[]>;
 readonly yearOrders:Record<string,P[]>;
 readonly display:Map<string,string>;
 constructor(rows:P[],readonly version:string){
  this.rows=[...rows].sort((a,b)=>a.sourceRank-b.sourceRank);this.byId=new Map(rows.map(p=>[p.summary.id,p]));
  if(rows.length>20000||this.byId.size!==rows.length)throw new ApiError(503,'PUBLIC_INDEX_BOUND');
  const rank=(a:P,b:P)=>a.sourceRank-b.sourceRank;
  this.orders={publish:[...rows].sort((a,b)=>lex(b.publishDate,a.publishDate)||rank(a,b)),updated:[...rows].sort((a,b)=>lex(b.updatedSort,a.updatedSort)||rank(a,b)),school:[...rows].sort((a,b)=>a.schoolRank-b.schoolRank||rank(a,b)),deadline:[...rows].sort((a,b)=>(a.deadlineMs??Number.MAX_SAFE_INTEGER)-(b.deadlineMs??Number.MAX_SAFE_INTEGER)||rank(a,b))};
  this.yearOrders=Object.fromEntries(Object.entries(this.orders).map(([k,v])=>[k,v.filter(p=>p.year===2026)]));
  this.display=new Map([...new Set(rows.map(p=>p.schoolName))].map(s=>[s,getDisplaySchoolName(s)]));
 }
 ordered(sort:string,now:number,yearOnly=false){const rows=(yearOnly?this.yearOrders:this.orders)[sort];if(sort!=='deadline')return rows;const pivot=rows.findIndex(p=>p.deadlineMs===null||p.deadlineMs>now);return pivot<0?rows:rows.slice(pivot).concat(rows.slice(0,pivot));}
 expiresAt(now:number){
  const today=new Date(now+28800000).toISOString().slice(0,10);let end=Math.min(now+6*3600000,Date.parse(today+'T00:00:00+08:00')+DAY);
  const rows=this.orders.deadline;
  for(const days of [0,1,3,7]){const boundary=now+days*DAY;let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>>1,d=rows[mid].deadlineMs??Number.MAX_SAFE_INTEGER;if(d<=boundary)lo=mid+1;else hi=mid;}if(lo<rows.length&&rows[lo].deadlineMs!==null)end=Math.min(end,rows[lo].deadlineMs!-days*DAY);}
  return end;
 }
 search(params:URLSearchParams,now:number){
  const {page:requested,pageSize}=noticeSql(params,now),v=(k:string,d='全部')=>params.get(k)?.trim()||d;
  const q=v('q','').toLowerCase(),school=v('school').toLowerCase(),major=v('major').toLowerCase(),region=v('region'),year=v('year','2026'),status=v('status'),quick=v('deadline');
  const broad=q.length>=4||/[a-z0-9]/i.test(q),today=new Date(now+28800000).toISOString().slice(0,10),fresh=v('fresh'),date=v('date','');
  const eq=['category','discipline','range','type','kind'].map(k=>[k,v(k)]).filter(([,s])=>s!=='全部');
  const ordered=this.ordered(v('sort','publish'),now,year==='2026');
  const filtered=Boolean(q||school!=='全部'||major!=='全部'||region!=='全部'||status!=='全部'||quick!=='全部'||eq.length||fresh!=='全部'||date);
  const found=filtered?ordered.filter(p=>{
   if(year!=='全部'&&p.year!==Number(year))return false;
   if(q&&!p.primary.includes(q)&&!(broad&&p.secondary.includes(q)))return false;
   if(school!=='全部'&&!p.schoolText.includes(school)||major!=='全部'&&!p.major.includes(major))return false;
   if(eq.some(([k,s])=>p[k as keyof P]!==s))return false;
   if(region!=='全部'&&p.region!==region&&!p.summary.tags.includes(region))return false;
   const d=p.deadlineMs,effective=d!==null&&d<=now?'已截止':d!==null&&d<=now+7*DAY?'即将截止':p.rawStatus||'报名中';
   if(status==='报名中'&&(d!==null&&d<=now||!['报名中','即将截止'].includes(effective)))return false;
   if(status==='未开始'&&effective!=='未开始')return false;
   if(status==='已结束'&&!(d!==null&&d<=now||['已截止','已结束','活动中'].includes(effective)))return false;
   if(quick!=='全部'&&(d===null||d<=now||d>now+({today:1,within3days:3,within7days:7}[quick]||0)*DAY))return false;
   if(fresh==='today'&&p.publishDate!==today||date&&p.publishDate!==date)return false;
   return true;
  }):ordered;
  const total=found.length,totalPages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(requested,totalPages);
  return {items:found.slice((page-1)*pageSize,page*pageSize).map(p=>liveSummary(p,now)),pagination:{page,pageSize,total,totalPages},metadataVersion:this.version,source:'recovery',servedAt:new Date(now).toISOString()};
 }
 metadata(params:URLSearchParams,now:number){
  for(const k of params.keys())if(!['section','version','category','region'].includes(k)||params.getAll(k).length!==1)throw new ApiError(400,'INVALID_METADATA_FILTER');
  const section=params.get('section'),category=params.get('category')?.trim()||'全部',region=params.get('region')?.trim()||'全部';
  if(!['summary','facets','colleges'].includes(section||''))throw new ApiError(400,'INVALID_METADATA_SECTION');
  noticeSql(new URLSearchParams({category,region}),now);
  if(params.get('version')!==this.version)throw new ApiError(409,'PUBLIC_VERSION_CHANGED');
  const today=new Date(now+28800000).toISOString().slice(0,10),latest=this.orders.publish[0]?.publishDate||'',todayRows=this.rows.filter(p=>p.publishDate===today),date=todayRows.length?today:latest;
  const common={section,version:this.version,servedAt:new Date(now).toISOString(),expiresAt:this.expiresAt(now)};
  if(section==='summary'){
   const updates=new Map<string,number>();for(const p of this.rows)if(p.publishDate===date){const s=this.display.get(p.schoolName)!;updates.set(s,(updates.get(s)||0)+1);}
   return {...common,stats:{total2026:this.rows.filter(p=>p.year===2026).length,todayUpdates:todayRows.length,deadlineWithin3Days:this.rows.filter(p=>p.deadlineMs!==null&&p.deadlineMs>now&&p.deadlineMs<=now+3*DAY).length},sideData:{urgentProjects:this.orders.deadline.filter(p=>p.deadlineMs!==null&&p.deadlineMs>now&&p.deadlineMs<=now+7*DAY).slice(0,5).map(p=>liveSummary(p,now)),latestProjects:this.orders.publish.filter(p=>p.deadlineMs===null||p.deadlineMs>now).slice(0,5).map(p=>liveSummary(p,now)),latestPublishDate:latest,todaySchoolUpdates:{date,hasTodayRows:todayRows.length>0,rows:[...updates].sort((a,b)=>b[1]-a[1]).slice(0,5)}}};
  }
  if(section==='facets'){
   const validSchool=(s:string)=>s&&s!=='待识别院校';
   return {...common,facets:{regions:getNoticeRegionOptions([...new Set(this.rows.map(p=>p.region))].map(r=>({tags:[r]} as PublicNoticeProject))),schools:[...new Set(this.rows.filter(p=>region==='全部'||p.region===region||p.summary.tags.includes(region)).map(p=>this.display.get(p.schoolName)!).filter(validSchool))].sort(collator.compare),categories:[...new Set(this.rows.map(p=>p.category).filter(Boolean))],disciplines:[...new Set(this.rows.filter(p=>category==='全部'||p.category===category).map(p=>p.discipline).filter(Boolean))]}};
  }
  type College={schoolName:string;total:number;active:number;summer:number;pre:number;push:number;nearDeadline:number;latestPublishDate:string};const colleges=new Map<string,College>();
  for(const p of this.rows){const name=this.display.get(p.schoolName)!;if(!name||name==='待识别院校')continue;let row=colleges.get(name);if(!row){row={schoolName:name,total:0,active:0,summer:0,pre:0,push:0,nearDeadline:0,latestPublishDate:''};colleges.set(name,row);}row.total++;if((p.deadlineMs===null||p.deadlineMs>now)&&!['已截止','已结束'].includes(p.rawStatus))row.active++;if(p.type==='夏令营')row.summer++;if(p.type==='预推免')row.pre++;if(p.type==='推免')row.push++;if(p.deadlineMs!==null&&p.deadlineMs>now&&p.deadlineMs<=now+7*DAY)row.nearDeadline++;if(p.publishDate>row.latestPublishDate)row.latestPublishDate=p.publishDate;}
  const collegeStats=[...colleges.values()].sort((a,b)=>b.active-a.active||b.total-a.total||lex(b.latestPublishDate,a.latestPublishDate)||collator.compare(a.schoolName,b.schoolName));return {...common,collegeStats,topColleges:collegeStats.slice(0,6)};
 }
}
const reviewedBase=new ReviewedIndex(base,snapshot.version);let current=reviewedBase;
const inflight=new Map<string,Promise<ReviewedIndex>>(),failed=new Map<string,number>();
async function version(db:D1Database){const v=await db.prepare("SELECT value FROM _runtime_state WHERE key='notice_version'").first<string>('value');if(!v)throw new ApiError(503,'NOTICE_PROJECTION_PENDING');return v;}
export async function reviewedVersion(db:D1Database){return publicOutageActive()?reviewedBase.version:version(db);}
// Check the authoritative version even on warm responses. A failure/withdrawal
// never falls back to the embedded reviewed base. Only public projections leave D1.
export async function reviewedIndex(db:D1Database,expectedVersion?:string):Promise<ReviewedIndex>{
 if(publicOutageActive())return reviewedBase;
 const v=expectedVersion??await version(db);if(v===current.version)return current;
 if((failed.get(v)||0)>Date.now())throw new ApiError(503,'PUBLIC_REFRESH_BACKOFF');
 const pending=inflight.get(v);if(pending)return pending;
 const task=(async()=>{
  try{
   const rows=new Map(base.map(p=>[p.summary.id,p]));let cursor='notice_override:';
   // Cache API calls share the Worker's subrequest budget. The former 80-row
   // match/query/put loop exhausted that budget during every cold refresh.
   // At most 40 read-only D1 pages plus version checks leave room for routing
   // and response-cache calls within the Free plan's 50-subrequest ceiling.
   const pageSize=500;
   for(let page=0;page<40;page++){
    type Change={key:string;visible:number;catalog_projection:string|null};
    const result=await db.prepare("SELECT v.key,json_extract(v.value,'$.visible') visible,CASE WHEN n.is_private=0 AND n.admin_status='published' AND n.admin_deleted_at IS NULL AND n.source_site<>'用户手动录入' AND n.id NOT LIKE 'custom-%' THEN n.catalog_projection ELSE NULL END catalog_projection FROM _runtime_state v LEFT JOIN main__notices n ON n.id=substr(v.key,17) WHERE v.key>? AND v.key<'notice_override;' ORDER BY v.key LIMIT 500").bind(cursor).all<Change>();
    const changes=result.results;
    if(new TextEncoder().encode(JSON.stringify(changes)).byteLength>4000000)throw new ApiError(503,'PUBLIC_INDEX_SHARD_LIMIT');
    for(const row of changes){if(!row.key.startsWith('notice_override:')||row.key<=cursor||![0,1].includes(row.visible))throw new ApiError(503,'PUBLIC_INDEX_INVALID');cursor=row.key;const id=row.key.slice(16);if(!row.visible||!row.catalog_projection)rows.delete(id);else{const p=JSON.parse(row.catalog_projection) as P;if(p.summary.id!==id||id.startsWith('custom-')||!Number.isFinite(p.sourceRank)||!Number.isFinite(p.schoolRank))throw new ApiError(503,'PUBLIC_INDEX_INVALID');rows.set(id,p);}}
    if(changes.length<pageSize){if(await version(db)!==v)throw new ApiError(409,'PUBLIC_VERSION_CHANGED');current=new ReviewedIndex([...rows.values()],v);return current;}
   }
   throw new ApiError(503,'PUBLIC_INDEX_CHANGE_LIMIT');
  }catch(e){if(failed.size>32)failed.clear();failed.set(v,Date.now()+60000);throw e;}finally{inflight.delete(v);}
 })();inflight.set(v,task);return task;
}
