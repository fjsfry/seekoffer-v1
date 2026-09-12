import {ApiError} from './auth.ts';
import {noticeSql,publicVisibility} from './notice-sql.ts';
import {liveSummary,type NoticeProjection} from './notice-projection.ts';
import {getDisplaySchoolName} from '../../../lib/notice-display';
import {getNoticeRegionOptions,type CollegeNoticeStats} from '../../../lib/notice-analytics';
import type {PublicNoticeProject} from '../../../lib/mock-data';

const p=(key:string)=>`json_extract(n.catalog_projection,'$.${key}')`;
const visible=publicVisibility+' AND n.catalog_projection IS NOT NULL';
const d=p('deadlineMs'),rank=p('sourceRank');
// Constructing an ICU collator for each comparator dominates a cold Free Worker request.
const chineseOrder=new Intl.Collator('zh-CN');
type ProjectionRow={catalog_projection:string};
// Only these two fields are needed to render a list item. Do not transport the
// search texts, taxonomies and sorting metadata from D1 to the Worker for each row.
export const summaryProjectionSql="json_object('summary',json_extract(catalog_projection,'$.summary'),'rawStatus',json_extract(catalog_projection,'$.rawStatus')) AS catalog_projection";
type Metadata={stats:{total2026:number;todayUpdates:number;deadlineWithin3Days:number};sideData:{urgentProjects:unknown[];latestProjects:unknown[];todaySchoolUpdates:{date:string;hasTodayRows:boolean;rows:[string,number][]};latestPublishDate:string;topColleges:CollegeNoticeStats[]};facets:{regions:string[];schools:string[];categories:string[];disciplines:string[];collegeStats:CollegeNoticeStats[]};expiresAt:number};

// Stores only bounded public aggregate data. Each lease is shared across
// instances, failures back off, and cache keys include the live data version.
async function cached<T>(db:D1Database,version:string,name:string,now:number,load:()=>Promise<{value:T;expiresAt:number}>) {
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('public-sql-v1:'+version+':'+name));
 const key=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
 const row=await db.prepare('SELECT result_json,expires_at FROM _notice_query_cache WHERE cache_key=? AND data_version=?').bind(key,version).first<{result_json:string|null;expires_at:number}>();
 if(row?.result_json&&row.expires_at>now)return{value:JSON.parse(row.result_json) as T,cache:'HIT'};
 const lease=await db.prepare('INSERT INTO _notice_query_cache(cache_key,data_version,expires_at,lock_until,result_json) VALUES(?,?,0,?,NULL) ON CONFLICT(cache_key) DO UPDATE SET lock_until=excluded.lock_until WHERE lock_until<=? RETURNING cache_key').bind(key,version,now+15000,now).first();
 if(!lease)throw new ApiError(503,'PUBLIC_REFRESH_IN_PROGRESS');
 const result=await load(),json=JSON.stringify(result.value);
 if(new TextEncoder().encode(json).byteLength>512000)throw new ApiError(503,'PUBLIC_AGGREGATE_TOO_LARGE');
 await db.prepare('UPDATE _notice_query_cache SET result_json=?,expires_at=?,lock_until=0 WHERE cache_key=? AND data_version=?').bind(json,result.expiresAt,key,version).run();
 return{value:result.value,cache:'MISS'};
}

async function metadata(db:D1Database,category:string,region:string,now:number,part:'full'|'summary'|'facets'|'colleges'='full'):Promise<Metadata> {
 const today=new Date(now+8*3600000).toISOString().slice(0,10),until3=now+3*86400000,until7=now+7*86400000;
 const active=`(${d} IS NULL OR ${d}>${now})`;
 const collegeActive=`${active} AND coalesce(${p('rawStatus')},'') NOT IN ('已截止','已结束')`;
 const first=`min(${rank})`;
 const queries=[
  `SELECT sum(n.year=2026) total2026,sum(n.publish_date=?) todayUpdates,sum(${d}>? AND ${d}<=?) deadlineWithin3Days,max(n.publish_date) latestPublishDate,`+[0,1,3,7].map((days,i)=>`min(CASE WHEN ${d}-${days*86400000}>${now} THEN ${d}-${days*86400000} END) b${i}`).join(',')+` FROM main__notices n WHERE ${visible}`,
  `SELECT catalog_projection FROM main__notices n WHERE ${visible} AND ${d}>${now} AND ${d}<=${until7} ORDER BY ${d},${rank} LIMIT 5`,
  `SELECT catalog_projection FROM main__notices n WHERE ${visible} AND ${active} ORDER BY n.publish_date DESC,${rank} LIMIT 5`,
  `SELECT ${p('schoolName')} schoolName,count(*) total,sum(${collegeActive}) active,sum(${p('type')}='夏令营') summer,sum(${p('type')}='预推免') pre,sum(${p('type')}='推免') push,sum(${d}>${now} AND ${d}<=${until7}) nearDeadline,max(n.publish_date) latestPublishDate,${first} firstRank FROM main__notices n WHERE ${visible} GROUP BY ${p('schoolName')} ORDER BY firstRank LIMIT 1001`,
  `SELECT ${p('category')} value,${first} firstRank FROM main__notices n WHERE ${visible} GROUP BY ${p('category')} ORDER BY firstRank LIMIT 1001`,
  `SELECT ${p('discipline')} value,${first} firstRank FROM main__notices n WHERE ${visible} AND (?='全部' OR ${p('category')}=?) GROUP BY ${p('discipline')} ORDER BY firstRank LIMIT 1001`,
  `SELECT ${p('schoolName')} value FROM main__notices n WHERE ${visible} AND (?='全部' OR ${p('region')}=? OR EXISTS(SELECT 1 FROM json_each(n.tags) WHERE value=?)) GROUP BY ${p('schoolName')} LIMIT 1001`,
  `SELECT DISTINCT ${p('region')} value FROM main__notices n WHERE ${visible} LIMIT 1001`
 ];
 const bind:unknown[][]=[[today,now,until3],[],[],[],[],[category,category],[region,region,region],[]];
 const selection=part==='full'?[0,1,2,3,4,5,6,7]:part==='summary'?[0,1,2]:part==='colleges'?[0,3]:[4,5,6,7];
 const queried=await db.batch<Record<string,unknown>>(selection.map(i=>db.prepare(queries[i]).bind(...bind[i])));
 const results=queries.map(()=>({results:[]} as Pick<D1Result<Record<string,unknown>>,'results'>));selection.forEach((i,n)=>{results[i]=queried[n];});
 for(const result of results)if(result.results.length>1000)throw new ApiError(503,'PUBLIC_AGGREGATE_LIMIT');
 const aggregate=(results[0].results[0]||{}) as Record<string,number|string|null>;
 const schools=new Map<string,CollegeNoticeStats>();
 for(const value of results[3].results){
  const schoolName=getDisplaySchoolName(String(value.schoolName||''));if(!schoolName||schoolName==='待识别院校')continue;
  let current=schools.get(schoolName);if(!current){current={schoolName,total:0,active:0,summer:0,pre:0,push:0,nearDeadline:0,latestPublishDate:''};schools.set(schoolName,current);}
  for(const key of ['total','active','summer','pre','push','nearDeadline'] as const)current[key]+=Number(value[key]||0);
  current.latestPublishDate=[current.latestPublishDate,String(value.latestPublishDate||'')].sort().at(-1)!;
 }
 const collegeStats=[...schools.values()].sort((a,b)=>b.active-a.active||b.total-a.total||b.latestPublishDate.localeCompare(a.latestPublishDate)||chineseOrder.compare(a.schoolName,b.schoolName));
 const latestPublishDate=String(aggregate.latestPublishDate||''),todayDate=Number(aggregate.todayUpdates)>0?today:latestPublishDate;
 const updateRows=todayDate&&['full','summary'].includes(part)?(await db.prepare(`SELECT ${p('schoolName')} schoolName,count(*) total,${first} firstRank FROM main__notices n WHERE ${visible} AND n.publish_date=? GROUP BY ${p('schoolName')} ORDER BY firstRank LIMIT 1001`).bind(todayDate).all<{schoolName:string;total:number}>()).results:[];
 if(updateRows.length>1000)throw new ApiError(503,'PUBLIC_AGGREGATE_LIMIT');
 const updates=new Map<string,number>();for(const row of updateRows){const name=getDisplaySchoolName(row.schoolName);updates.set(name,(updates.get(name)||0)+row.total);}
 const expiresAt=Math.min(now+60000,Date.parse(today+'T00:00:00+08:00')+86400000,...[0,1,2,3].map(i=>Number(aggregate['b'+i])||Infinity));
 const textValues=(i:number)=>results[i].results.map(r=>String(r.value||'')).filter(Boolean);
 return{stats:{total2026:Number(aggregate.total2026||0),todayUpdates:Number(aggregate.todayUpdates||0),deadlineWithin3Days:Number(aggregate.deadlineWithin3Days||0)},
  sideData:{urgentProjects:(results[1].results as ProjectionRow[]).map(r=>liveSummary(JSON.parse(r.catalog_projection),now)),latestProjects:(results[2].results as ProjectionRow[]).map(r=>liveSummary(JSON.parse(r.catalog_projection),now)),latestPublishDate,todaySchoolUpdates:{date:todayDate,hasTodayRows:Number(aggregate.todayUpdates)>0,rows:[...updates.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5)},topColleges:collegeStats.slice(0,6)},
  facets:{regions:getNoticeRegionOptions(textValues(7).map(r=>({tags:[r]} as PublicNoticeProject))),schools:[...new Set(textValues(6).map(getDisplaySchoolName).filter(s=>s&&s!=='待识别院校'))].sort(chineseOrder.compare),categories:textValues(4),disciplines:textValues(5),collegeStats},expiresAt};
}

export async function publicNoticeRows(db:D1Database,params:URLSearchParams,now=Date.now(),cacheReader:typeof cached=cached){
 const query=noticeSql(params,now),version=await db.prepare("SELECT value FROM _runtime_state WHERE key='notice_version'").first<string>('value');if(!version)throw new ApiError(503,'NOTICE_PROJECTION_PENDING');
 const loadCount=async()=>({value:Number(await db.prepare('SELECT count(*) total FROM main__notices n WHERE '+query.where).bind(...query.values).first('total')),expiresAt:Math.min(now+60000,Date.parse(new Date(now+28800000).toISOString().slice(0,10)+'T00:00:00+08:00')+86400000)});
 const timed=['status','deadline'].some(k=>params.has(k)&&params.get(k)!=='全部');
 const count=timed?{...await loadCount(),cache:'BYPASS'}:await cacheReader(db,version,'page-count-v2:'+query.countKey,now,loadCount);
 const total=count.value,totalPages=Math.max(1,Math.ceil(total/query.pageSize)),page=Math.min(query.page,totalPages);
 const [rows,ending]=await db.batch([
  db.prepare('SELECT '+summaryProjectionSql+' FROM main__notices n WHERE '+query.where+' ORDER BY '+query.order+' LIMIT ? OFFSET ?').bind(...query.values,query.pageSize,(page-1)*query.pageSize),
  db.prepare("SELECT value FROM _runtime_state WHERE key='notice_version'")
 ]);
 if(version!==(ending.results[0] as {value:string}|undefined)?.value)throw new ApiError(503,'PUBLIC_VERSION_CHANGED');
 return{body:{items:(rows.results as ProjectionRow[]).map(r=>liveSummary(JSON.parse(r.catalog_projection),now)),pagination:{page,pageSize:query.pageSize,total,totalPages},metadataVersion:version,source:'recovery',servedAt:new Date(now).toISOString()},version,cache:{count:count.cache}};
}

export async function publicNoticeMetadata(db:D1Database,params:URLSearchParams,now=Date.now(),cacheReader:typeof cached=cached){
 for(const k of params.keys())if(!['section','version','category','region'].includes(k)||params.getAll(k).length!==1)throw new ApiError(400,'INVALID_METADATA_FILTER');
 const section=params.get('section');if(!['summary','facets','colleges'].includes(section||''))throw new ApiError(400,'INVALID_METADATA_SECTION');
 const category=params.get('category')?.trim()||'全部',region=params.get('region')?.trim()||'全部';noticeSql(new URLSearchParams({category,region}));
 const requested=params.get('version');if(!requested||requested.length>100)throw new ApiError(400,'INVALID_METADATA_VERSION');
 const version=await db.prepare("SELECT value FROM _runtime_state WHERE key='notice_version'").first<string>('value');if(version!==requested)throw new ApiError(409,'PUBLIC_VERSION_CHANGED');
 const key='metadata-part-v2:'+JSON.stringify([section,section==='facets'?category:'全部',section==='facets'?region:'全部']);
 const result=await cacheReader(db,version,key,now,async()=>{const all=await metadata(db,category,region,now,section as 'summary'|'facets'|'colleges');
  const value=section==='summary'?{stats:all.stats,sideData:{...all.sideData,topColleges:undefined}}:section==='colleges'?{collegeStats:all.facets.collegeStats,topColleges:all.sideData.topColleges}:{facets:{...all.facets,collegeStats:undefined}};
  return{value:{...value,expiresAt:all.expiresAt},expiresAt:all.expiresAt};});
 if(version!==await db.prepare("SELECT value FROM _runtime_state WHERE key='notice_version'").first('value'))throw new ApiError(409,'PUBLIC_VERSION_CHANGED');
 return{body:{...result.value,section,version,servedAt:new Date(now).toISOString()},cache:result.cache,version};
}

export async function publicNoticePage(db:D1Database,params:URLSearchParams,now=Date.now(),cacheReader:typeof cached=cached) {
 const query=noticeSql(params,now);
 const version=await db.prepare("SELECT value FROM _runtime_state WHERE key='notice_version'").first<string>('value');
 if(!version)throw new ApiError(503,'NOTICE_PROJECTION_PENDING');
 const category=params.get('category')?.trim()||'全部',region=params.get('region')?.trim()||'全部';
 const meta=await cacheReader(db,version,'metadata:'+JSON.stringify([category,region]),now,async()=>{const value=await metadata(db,category,region,now);return{value,expiresAt:value.expiresAt};});
 const count=await cacheReader(db,version,'count:'+query.countKey,now,async()=>({value:Number(await db.prepare('SELECT count(*) total FROM main__notices n WHERE '+query.where).bind(...query.values).first('total')),expiresAt:meta.value.expiresAt}));
 const total=count.value,totalPages=Math.max(1,Math.ceil(total/query.pageSize)),page=Math.min(query.page,totalPages);
 const rows=await db.prepare('SELECT catalog_projection FROM main__notices n WHERE '+query.where+' ORDER BY '+query.order+' LIMIT ? OFFSET ?').bind(...query.values,query.pageSize,(page-1)*query.pageSize).all<ProjectionRow>();
 const finalVersion=await db.prepare("SELECT value FROM _runtime_state WHERE key='notice_version'").first<string>('value');
 if(finalVersion!==version)throw new ApiError(503,'PUBLIC_VERSION_CHANGED');
 return{body:{items:rows.results.map(r=>liveSummary(JSON.parse(r.catalog_projection) as NoticeProjection,now)),pagination:{page,pageSize:query.pageSize,total,totalPages},stats:meta.value.stats,sideData:meta.value.sideData,facets:meta.value.facets,source:'recovery',servedAt:new Date(now).toISOString()},version,cache:{metadata:meta.cache,count:count.cache}};
}
