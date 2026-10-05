import {readAnalytics,type AnalyticsConfig} from './analytics.ts';
import {ApiError} from './auth.ts';
import {readClerkUser,type BootstrapConfig} from './identity-bootstrap.ts';
import {getDeadlineTimestamp} from '../../../lib/deadline-display';
import {overrideStatements} from './notice-overrides.ts';
import {prepareNoticeOrder} from './notice-order';
export type Admin={email:string;name:string;role:string;status:string;ownerId?:string};
const permissions:Record<string,string[]>={super_admin:['overview','content','users','settings','logs'],ops_manager:['overview','content','users','logs'],content_reviewer:['overview','content'],readonly_admin:['overview','logs']};
function permit(admin:Admin,permission:string){if(!permissions[admin.role]?.includes(permission))throw new ApiError(403,'ADMIN_PERMISSION_DENIED');}
function str(value:unknown,max=200){if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u001f]/.test(value))throw new ApiError(400,'INVALID_FILTER');return value.trim();}
function multiline(value:unknown,max:number){if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw new ApiError(400,'INVALID_TEXT');return value.trim();}
function int(value:unknown,defaultValue:number,max:number){const n=value===undefined?defaultValue:Number(value);if(!Number.isSafeInteger(n)||n<1||n>max)throw new ApiError(400,'INVALID_PAGE');return n;}
function options(value:unknown,list:string[]){const s=str(value);if(!list.includes(s))throw new ApiError(400,'INVALID_OPTION');return s;}
function fields(body:Record<string,unknown>,allowed:string[]){if(Object.keys(body).some(k=>!allowed.includes(k)))throw new ApiError(400,'UNSUPPORTED_FIELD');}
function today(offset=0){return new Date(Date.parse(new Date(Date.now()+28800000).toISOString().slice(0,10)+'T00:00:00+08:00')+offset*86400000).toISOString();}
function parse(row:Record<string,unknown>){const r={...row};for(const k of ['value','before_data','after_data'])if(typeof r[k]==='string')r[k]=JSON.parse(r[k] as string);for(const k of ['is_anonymous','is_official','is_private','is_verified'])if(k in r)r[k]=Boolean(r[k]);return r;}
export async function requireSnapshotAdmin(db:D1Database,owner:string,identity:{issuer:string;subject:string},config:BootstrapConfig,fetcher:typeof fetch){
 const user=await readClerkUser(identity,config,fetcher),email=user.email_addresses.find(e=>e.id===user.primary_email_address_id)?.email_address?.toLowerCase();if(!email)throw new ApiError(403,'ADMIN_REQUIRED');
 const admin=await db.prepare("SELECT email,name,role,status FROM main__admin_users WHERE lower(email)=? AND status='active' AND (user_id=? OR user_id IS NULL)").bind(email,owner).first<Admin>();if(!admin||!permissions[admin.role])throw new ApiError(403,'ADMIN_REQUIRED');return{...admin,ownerId:owner};
}
async function clerkUsers(params:URLSearchParams,config:BootstrapConfig,fetcher:typeof fetch){
 if(!config.CLERK_BACKEND_SECRET)throw new ApiError(503,'ACCOUNT_PROVISIONING_PENDING');const r=await fetcher('https://api.clerk.com/v1/users?'+params,{headers:{Authorization:'Bearer '+config.CLERK_BACKEND_SECRET},redirect:'manual',signal:AbortSignal.timeout(8000)});if(!r.ok)throw new ApiError(503,'ADMIN_AUTH_LOOKUP_UNAVAILABLE');const rows=await r.json() as {id:string;primary_email_address_id:string;email_addresses:{id:string;email_address:string}[]}[];if(!Array.isArray(rows)||rows.some(r=>typeof r.id!=='string'))throw new ApiError(503,'ADMIN_AUTH_LOOKUP_UNAVAILABLE');return rows;
}
async function listUsers(db:D1Database,body:Record<string,unknown>,config:BootstrapConfig,fetcher:typeof fetch){
 const page=int(body.page,1,100000),pageSize=int(body.pageSize,10,100),f=body.filters&&typeof body.filters==='object'?body.filters as Record<string,unknown>:{};const terms:string[]=[],values:unknown[]=[];const q=str(f.query),status=str(f.status),activity=str(f.activity);
 if(f.userId){terms.push('p.id=?');values.push(str(f.userId,180));}
 if(status&&status!=='all'){options(status,['active','restricted','banned','deleted']);terms.push("coalesce(m.status,'active')=?");values.push(status);}
 if(activity&&activity!=='all'){options(activity,['today','7d','30d']);terms.push('p.updated_at>=?');values.push(today(activity==='today'?0:activity==='7d'?-6:-29));}
 if(q.includes('@')){
  const subjects:string[]=[];for(let offset=0;;offset+=100){if(offset>=2000)throw new ApiError(400,'SEARCH_TOO_BROAD');const found=await clerkUsers(new URLSearchParams({query:q,limit:'100',offset:String(offset)}),config,fetcher);subjects.push(...found.map(u=>u.id));if(found.length<100)break;}
  terms.push("p.id IN (SELECT legacy_user_id FROM _identity_links WHERE legacy_project_ref='mnotoltpythkayguhnrk' AND subject IN (SELECT value FROM json_each(?)))");values.push(JSON.stringify(subjects));
 }else if(q){terms.push("instr(lower(p.nickname||' '||p.undergraduate_school||' '||p.major||' '||p.target_major),lower(?))>0");values.push(q);}
 const where=terms.length?' WHERE '+terms.join(' AND '):'',join=' FROM main__profiles p LEFT JOIN main__user_moderation m ON m.user_id=p.id';
 const total=await scalar(db,'SELECT count(*) AS n'+join+where,values);
 const rows=await db.prepare("SELECT p.id,p.nickname,p.age,p.undergraduate_school,p.major,p.grade,p.target_major,p.target_region,p.created_at,p.updated_at,coalesce(m.status,'active') AS moderation_status,coalesce(m.note,'') AS moderation_note,(SELECT count(*) FROM main__applications a WHERE a.user_id=p.id) AS application_count,(SELECT count(*) FROM main__offer_posts o WHERE o.user_id=p.id) AS offer_count"+join+where+' ORDER BY p.updated_at DESC,p.id LIMIT ? OFFSET ?').bind(...values,pageSize,(page-1)*pageSize).all<Record<string,unknown>>();
 const ids=rows.results.map(r=>r.id),links=ids.length?await db.prepare("SELECT subject,legacy_user_id FROM _identity_links WHERE legacy_project_ref='mnotoltpythkayguhnrk' AND legacy_user_id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(ids)).all<{subject:string;legacy_user_id:string}>():{results:[]};
 const noticeCounts=ids.length?await db.prepare('SELECT created_by,count(*) AS n FROM main__notices WHERE created_by IN (SELECT value FROM json_each(?)) GROUP BY created_by').bind(JSON.stringify(ids)).all<{created_by:string;n:number}>():{results:[]};const submitted=new Map(noticeCounts.results.map(r=>[r.created_by,r.n]));
 const email=new Map<string,string>();if(links.results.length){const params=new URLSearchParams({limit:'100'});for(const l of links.results)params.append('user_id',l.subject);const users=await clerkUsers(params,config,fetcher);const allowed=new Map(links.results.map(l=>[l.subject,l.legacy_user_id]));for(const user of users){const id=allowed.get(user.id);if(!id)throw new ApiError(503,'ADMIN_AUTH_LOOKUP_SCOPE');email.set(id,user.email_addresses.find(e=>e.id===user.primary_email_address_id)?.email_address||'');}}
 const moderation=await grouped(db,'main__user_moderation','status'),all=await scalar(db,'SELECT count(*) AS n FROM main__profiles');
 return{users:rows.results.map(r=>({...r,email:email.get(String(r.id))||'',notice_count:submitted.get(String(r.id))||0})),total,page,pageSize,metrics:{totalUsers:all,todayUsers:await scalar(db,'SELECT count(*) AS n FROM main__profiles WHERE created_at>=?',[today()]),normalUsers:all-(moderation.restricted||0)-(moderation.banned||0)-(moderation.deleted||0),restrictedUsers:moderation.restricted||0,bannedUsers:moderation.banned||0,deletedUsers:moderation.deleted||0}};
}
async function grouped(db:D1Database,table:string,status:string,extra=''){const r=await db.prepare(`SELECT ${status} AS status,count(*) AS n FROM ${table} ${extra} GROUP BY ${status}`).all<{status:string;n:number}>();return Object.fromEntries(r.results.map(r=>[r.status,r.n]));}
async function scalar(db:D1Database,sql:string,values:unknown[]=[]){const r=await db.prepare(sql).bind(...values).first<{n:number}>();return Number(r?.n||0);}
async function overview(db:D1Database){
 const metrics:Record<string,number>={};
 const specs=[['Users','main__profiles'],['Notices','main__notices'],['Offers','main__offer_posts'],['Applications','main__applications'],['Feedback','main__feedback_reports']];
 for(const [label,table]of specs){const where=label==='Notices'?' WHERE admin_deleted_at IS NULL':label==='Offers'?' WHERE deleted_at IS NULL':'';const row=await db.prepare(`SELECT count(*) AS total,sum(created_at>=?) AS today FROM ${table}${where}`).bind(today()).first<{total:number;today:number}>();metrics['total'+label]=row!.total;metrics['today'+label]=row!.today||0;}
 for(const [suffix,table,column]of [['Users','main__user_moderation','status'],['Notices','main__notices','admin_status'],['Offers','main__offer_posts','review_status'],['Feedback','main__feedback_reports','status']]){
  const values=await grouped(db,table,column);for(const state of ['pending','published','rejected','hidden','deleted','approved','restricted','banned','processing','resolved','closed'])metrics[state+suffix]=values[state]||0;
 }
 metrics.normalUsers=Math.max(0,metrics.totalUsers-metrics.restrictedUsers-metrics.bannedUsers-metrics.deletedUsers);
 const trends=Array.from({length:7},(_,i)=>({date:new Date(Date.parse(today(i-6))+28800000).toISOString().slice(5,10),users:0,notices:0,offers:0,applications:0}));
 for(const [key,table]of [['users','main__profiles'],['notices','main__notices'],['offers','main__offer_posts'],['applications','main__applications']] as const){const r=await db.prepare(`SELECT strftime('%m-%d',created_at,'+8 hours') AS day,count(*) AS n FROM ${table} WHERE created_at>=? GROUP BY day`).bind(today(-6)).all<{day:string;n:number}>();for(const row of r.results){const t=trends.find(t=>t.date===row.day);if(t)t[key]=row.n;}}
 return{metrics,trends};
}
async function list(db:D1Database,resource:string,body:Record<string,unknown>){
 const page=int(body.page,1,100000),pageSize=int(body.pageSize,10,100),filter=body.filters&&typeof body.filters==='object'&&!Array.isArray(body.filters)?body.filters as Record<string,unknown>:{};
 const definitions:Record<string,{table:string;key:string;columns:string;search:string[];date:string;status?:string}>={
  offers:{table:'main__offer_posts',key:'offers',columns:'id,author_name,school_name,major,project_type,result,undergraduate_background,content,is_anonymous,review_status,reports_count,created_at,content_type,title,category,is_official,source_label,comments_count,follows_count,review_note',search:['author_name','school_name','major','title','content','category'],date:'created_at',status:'review_status'},
  feedback:{table:'main__feedback_reports',key:'feedback',columns:'id,type,module,target_id,content,status,handler,handler_note,created_at,handled_at',search:['content','target_id','handler'],date:'created_at',status:'status'},
  notices:{table:'main__notices',key:'notices',columns:'id,school_name,department_name,project_name,project_type,source_link,apply_link,publish_date,deadline_date,requirements,remarks,status,is_verified,last_checked_at,admin_status,is_private,created_at,updated_at_ts,admin_reviewed_by,admin_reviewed_at,admin_review_note,admin_deleted_at',search:['project_name','school_name','department_name'],date:'publish_date',status:'admin_status'},
  logs:{table:'main__admin_operation_logs',key:'logs',columns:'id,admin_email,action,module,target_id,ip_address,result,remark,created_at',search:['target_id','remark','ip_address'],date:'created_at'},
  ai_waitlist:{table:'main__ai_waitlist_leads',key:'leads',columns:'id,user_id,wechat_id,primary_need,details,submitted_at_text,source,created_at',search:['wechat_id','primary_need','details'],date:'created_at'},
  crawlers:{table:'main__crawler_runs',key:'runs',columns:'id,source,notices_received,notices_upserted,success,summary,created_at',search:['source'],date:'created_at'}
 };
 const d=definitions[resource];if(!d)throw new ApiError(400,'INVALID_RESOURCE');const terms:string[]=[],values:unknown[]=[];
 const status=str(filter.status,40),scope=str(filter.scope,40);
 if(resource==='notices'){if(status==='deleted'||scope==='deleted')terms.push('admin_deleted_at IS NOT NULL');else if(scope!=='all_with_deleted')terms.push('admin_deleted_at IS NULL');}
 if(resource==='offers')terms.push(status==='deleted'?'deleted_at IS NOT NULL':'deleted_at IS NULL');
 if(d.status&&status&&status!=='all'&&status!=='deleted'){terms.push(d.status+'=?');values.push(status);}
 if(resource==='notices'&&scope==='hidden'){terms.push("admin_status='hidden'");}
 for(const [key,col]of Object.entries({school:'school_name',major:'major',contentType:'content_type',category:'category',type:resource==='notices'?'project_type':'type',module:'module',operator:'admin_email',action:'action'})){
  const v=str(filter[key]);if(!v||v==='all')continue;if(!d.columns.split(',').includes(col))throw new ApiError(400,'INVALID_FILTER');terms.push(`instr(lower(${col}),lower(?))>0`);values.push(v);
 }
 const q=str(filter.query);if(q){terms.push('('+d.search.map(c=>`instr(lower(${c}),lower(?))>0`).join(' OR ')+')');values.push(...d.search.map(()=>q));}
 for(const [key,op]of [['dateFrom','>='],['dateTo','<=']]){const v=str(filter[key]);if(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))throw new ApiError(400,'INVALID_DATE');terms.push(d.date+op+'?');values.push(resource==='notices'?v:new Date(v+(op==='>='?'T00:00:00+08:00':'T23:59:59.999+08:00')).toISOString());}}
 const where=terms.length?' WHERE '+terms.join(' AND '):'',total=await scalar(db,`SELECT count(*) AS n FROM ${d.table}`+where,values);
 const sorts:Record<string,string>={publish_desc:'publish_date DESC,id',deadline_asc:'deadline_date,id',updated_desc:'updated_at_ts DESC,id'};
 const order=resource==='notices'?(sorts[str(body.sort)||'publish_desc']||''):d.date+' DESC,id';if(!order)throw new ApiError(400,'INVALID_SORT');
 const rows=await db.prepare(`SELECT ${d.columns} FROM ${d.table}${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...values,pageSize,(page-1)*pageSize).all<Record<string,unknown>>();
 let metrics:Record<string,number>={};if(d.status)metrics=await grouped(db,d.table,d.status);
 if(resource==='offers'){const types=await grouped(db,d.table,'content_type');metrics={pending:0,approved:0,rejected:0,hidden:0,deleted:0,...metrics,offerPosts:types.offer||0,discussions:types.discussion||0};}
 if(resource==='notices')metrics={pending:0,published:0,rejected:0,hidden:0,deleted:0,...metrics};
 if(resource==='feedback')metrics={pending:0,processing:0,resolved:0,closed:0,...metrics};
 if(resource==='logs'){const r=await db.prepare("SELECT sum(created_at>=?) AS todayOperations,sum(instr(action,'delete')>0) AS deleteOperations,sum(instr(action,'user_status')>0) AS banOperations,sum(result='failed') AS failedOperations FROM main__admin_operation_logs").bind(today()).first<Record<string,number>>();metrics=Object.fromEntries(Object.entries(r||{}).map(([k,v])=>[k,v||0]));}
 return{[d.key]:rows.results.map(parse),total,page,pageSize,metrics};
}
async function auditMutation(db:D1Database,admin:Admin,module:string,target:string,before:unknown,after:unknown,change:D1PreparedStatement,note:string,extra:D1PreparedStatement[]=[]){
 const log=db.prepare('INSERT INTO main__admin_operation_logs(admin_email,action,module,target_id,before_data,after_data,remark) VALUES(?,?,?,?,?,?,?)').bind(admin.email,'update_'+module,module,target,JSON.stringify(before||{}),JSON.stringify(after||{}),note);
 const results=await db.batch([change,...extra,log]);return results[0].results[0];
}
export async function adminAction(db:D1Database,admin:Admin,body:Record<string,unknown>,writes:boolean,config:BootstrapConfig&AnalyticsConfig={},fetcher:typeof fetch=fetch){
 fields(body,['resource','action','id','ids','status','note','key','value','notice','page','pageSize','filters','sort']);const resource=str(body.resource,40),action=str(body.action,40)||'list';
 if(resource==='me')return{admin};
 const permission=resource==='settings'?'settings':['users','feedback','ai_waitlist'].includes(resource)?'users':resource==='logs'?'logs':['notices','offers','comments'].includes(resource)?'content':'overview';permit(admin,permission);
 if(resource==='analytics')return readAnalytics(db,config);
 if(resource==='users'&&action==='list')return listUsers(db,body,config,fetcher);
 if(resource==='overview')return overview(db);
 if(resource==='shell'&&action==='snapshot')return{overview:{metrics:{pendingNotices:await scalar(db,"SELECT count(*) AS n FROM main__notices WHERE admin_status='pending' AND admin_deleted_at IS NULL"),pendingOffers:await scalar(db,"SELECT count(*) AS n FROM main__offer_posts WHERE review_status='pending' AND deleted_at IS NULL"),pendingFeedback:permissions[admin.role].includes('users')?await scalar(db,"SELECT count(*) AS n FROM main__feedback_reports WHERE status='pending'"):0}},analytics:await readAnalytics(db,config)};
 if(resource==='dashboard'&&action==='snapshot')return{overview:await overview(db),analytics:await readAnalytics(db,config),notices:permissions[admin.role].includes('content')?await list(db,'notices',{pageSize:5,filters:{status:'pending'},sort:'updated_desc'}):{notices:[],total:0},offers:permissions[admin.role].includes('content')?await list(db,'offers',{pageSize:20}):{offers:[],total:0},feedback:permissions[admin.role].includes('users')?await list(db,'feedback',{pageSize:5}):{feedback:[],total:0},downloads:{available:false,total:null,today:null,sevenDays:null,trackingStartedAt:'2026-09-03'}};
 if(action==='list'&&['offers','feedback','notices','logs','ai_waitlist','crawlers'].includes(resource))return list(db,resource,body);
 if(resource==='settings'&&action==='list'){const rows=await db.prepare('SELECT key,value,description,updated_by,updated_at FROM main__admin_system_settings ORDER BY key').all<Record<string,unknown>>();return{settings:rows.results.map(parse)};}
 if(!writes)throw new ApiError(503,'MIGRATION_READ_ONLY');
 const target=str(body.id,180),note=multiline(body.note,2000),timestamp=new Date().toISOString();
 if(resource==='notices'&&action==='create'){
  if(!body.notice||typeof body.notice!=='object'||Array.isArray(body.notice))throw new ApiError(400,'INVALID_NOTICE');const n=body.notice as Record<string,unknown>;
  fields(n,['id','school_name','department_name','project_name','project_type','discipline','publish_date','deadline_date','apply_link','source_link','requirements','remarks','status','year','deadline_level']);
  const id=str(n.id,180)||crypto.randomUUID();const payload={id,school_name:str(n.school_name,200),department_name:str(n.department_name,200),project_name:str(n.project_name,500),project_type:str(n.project_type,40)||'预推免',discipline:str(n.discipline,200),publish_date:str(n.publish_date,10)||new Date(Date.now()+28800000).toISOString().slice(0,10),deadline_date:str(n.deadline_date,40),apply_link:str(n.apply_link,2000),source_link:str(n.source_link,2000),requirements:multiline(n.requirements,50000),admin_review_note:multiline(n.remarks,10000),status:str(n.status,40)||'报名中',year:n.year===undefined?2026:int(n.year,2026,2100),deadline_level:str(n.deadline_level,40)||'future',source_site:'admin-manual',is_verified:1,admin_status:'pending',is_private:1,created_by:admin.ownerId||null};
  if(!payload.school_name||!payload.project_name)throw new ApiError(400,'REQUIRED_NOTICE_FIELDS');for(const key of ['publish_date','deadline_date'] as const){const v=payload[key];if(!v)continue;const date=v.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}(?:[ T](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(v)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||getDeadlineTimestamp(v)===Number.MAX_SAFE_INTEGER)throw new ApiError(400,'INVALID_DATE');}
  for(const link of [payload.source_link,payload.apply_link])if(link){let u:URL;try{u=new URL(link);}catch{throw new ApiError(400,'INVALID_URL');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new ApiError(400,'INVALID_URL');}
  const keys=Object.keys(payload),matches=(row:Record<string,unknown>)=>keys.filter(k=>!['admin_status','is_private'].includes(k)).every(k=>row[k]===payload[k as keyof typeof payload]);
  const prior=await db.prepare('SELECT * FROM main__notices WHERE id=?').bind(id).first<Record<string,unknown>>();if(prior){if(!matches(prior))throw new ApiError(409,'IDEMPOTENCY_CONFLICT');return{notice:prior,cacheRevalidated:false};}
  const inserted=await db.batch([db.prepare('INSERT INTO main__notices('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+') ON CONFLICT(id) DO NOTHING RETURNING *').bind(...Object.values(payload)),db.prepare("INSERT INTO main__admin_operation_logs(admin_email,action,module,target_id,after_data,remark) SELECT ?,'create_notice','notices',?,?,'管理员新建通知' WHERE changes()>0").bind(admin.email,id,JSON.stringify(payload))]);
  const record=inserted[0].results[0]||await db.prepare('SELECT * FROM main__notices WHERE id=?').bind(id).first<Record<string,unknown>>();if(!record||!matches(record as Record<string,unknown>))throw new ApiError(409,'IDEMPOTENCY_CONFLICT');return{notice:record,cacheRevalidated:false};
 }
 if(resource==='notices'&&['update_status','bulk_update_status'].includes(action)){
  const ids=action==='bulk_update_status'?body.ids:[target];if(!Array.isArray(ids)||ids.length===0||ids.length>6)throw new ApiError(400,'INVALID_ID_BATCH');const unique=[...new Set(ids.map(id=>str(id,180)))];if(unique.some(id=>!id))throw new ApiError(400,'INVALID_ID');const status=options(body.status,['pending','published','rejected','hidden','deleted']),statements:D1PreparedStatement[]=[];
  const changes:{before:Record<string,unknown>;after:Record<string,unknown>;patch:Record<string,unknown>}[]=[];
  for(const id of unique){const before=await db.prepare('SELECT * FROM main__notices WHERE id=?').bind(id).first<Record<string,unknown>>();if(!before)throw new ApiError(404,'NOTICE_UNAVAILABLE');if(status==='published'&&before.is_private&&before.created_by&&before.source_site!=='admin-manual'&&!await db.prepare('SELECT key FROM _runtime_state WHERE key=?').bind('notice_override:'+id).first())throw new ApiError(403,'PRIVATE_PROJECT_CANNOT_BE_PUBLISHED');
   const patch={admin_status:status,is_private:status==='published'?0:1,admin_deleted_at:status==='deleted'?timestamp:null,admin_reviewed_by:admin.email,admin_reviewed_at:timestamp,admin_review_note:body.note===undefined?String(before.admin_review_note||''):note,updated_at_ts:timestamp};const after={...before,...patch};
   changes.push({before,after,patch});
  }
  const ordering=await prepareNoticeOrder(db,changes);statements.push(...ordering.begin);
  for(const {before,after,patch}of changes){const id=String(after.id);statements.push(db.prepare('UPDATE main__notices SET '+Object.keys(patch).map(k=>k+'=?').join(',')+' WHERE id=?').bind(...Object.values(patch),id),...overrideStatements(db,before,after,false,ordering.orders.get(id)),db.prepare('INSERT INTO main__admin_operation_logs(admin_email,action,module,target_id,before_data,after_data,remark) VALUES(?,?,?,?,?,?,?)').bind(admin.email,'update_notice_status','notices',id,JSON.stringify({admin_status:before.admin_status,is_private:before.is_private}),JSON.stringify(patch),note));}
  statements.push(...ordering.end);try{await db.batch(statements);}catch(e){if(e instanceof Error&&/CHECK constraint failed/.test(e.message))throw new ApiError(409,'NOTICE_CONCURRENT_CHANGE');throw e;}
  const rows=await db.prepare('SELECT * FROM main__notices WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(unique)).all();return{notices:rows.results,count:rows.results.length,cacheRevalidated:true};
 }
 if(resource==='offers'&&action==='update_status'){
  const status=options(body.status,['approved','rejected','hidden','deleted']);const before=await db.prepare('SELECT * FROM main__offer_posts WHERE id=?').bind(target).first();if(!before)throw new ApiError(404,'POST_UNAVAILABLE');
  const patch={review_status:status,hidden_at:status==='hidden'?timestamp:null,deleted_at:status==='deleted'?timestamp:null,reviewed_by:admin.email,reviewed_at:timestamp,review_note:note};
  const row=await auditMutation(db,admin,'offers',target,before,patch,db.prepare('UPDATE main__offer_posts SET review_status=?,hidden_at=?,deleted_at=?,reviewed_by=?,reviewed_at=?,review_note=?,updated_at=? WHERE id=? RETURNING *').bind(...Object.values(patch),timestamp,target),note);return{offer:row};
 }
 if(resource==='feedback'&&action==='update_status'){
  const status=options(body.status,['pending','processing','resolved','closed']);const before=await db.prepare('SELECT * FROM main__feedback_reports WHERE id=?').bind(target).first();if(!before)throw new ApiError(404,'RECORD_UNAVAILABLE');const patch={status,handler:admin.email,handler_note:note,handled_at:status==='pending'?null:timestamp};
  const row=await auditMutation(db,admin,'feedback',target,before,patch,db.prepare('UPDATE main__feedback_reports SET status=?,handler=?,handler_note=?,handled_at=?,updated_at=? WHERE id=? RETURNING *').bind(...Object.values(patch),timestamp,target),note);return{feedback:row};
 }
 if(resource==='users'&&action==='update_status'){
  const status=options(body.status,['active','restricted','banned','deleted']);if(!await db.prepare('SELECT id FROM main__profiles WHERE id=?').bind(target).first())throw new ApiError(404,'RECORD_UNAVAILABLE');
  if(target===admin.ownerId||await db.prepare("SELECT id FROM main__admin_users WHERE user_id=? AND status='active'").bind(target).first())throw new ApiError(403,'ADMIN_ACCOUNT_CHANGE_REQUIRES_REVIEW');
  const unbound=await db.prepare("SELECT email FROM main__admin_users WHERE user_id IS NULL AND status='active'").all<{email:string}>();
  if(unbound.results.length){
   const link=await db.prepare("SELECT subject FROM _identity_links WHERE legacy_user_id=? AND legacy_project_ref='mnotoltpythkayguhnrk' AND issuer='https://clerk.seekoffer.com.cn'").bind(target).first<{subject:string}>();if(!link)throw new ApiError(403,'ADMIN_ACCOUNT_CHANGE_REQUIRES_REVIEW');
   const users=await clerkUsers(new URLSearchParams({user_id:link.subject,limit:'1'}),config,fetcher);if(users.length!==1||users[0].id!==link.subject)throw new ApiError(503,'ADMIN_AUTH_LOOKUP_SCOPE');const email=users[0].email_addresses.find(e=>e.id===users[0].primary_email_address_id)?.email_address?.toLowerCase();if(!email||unbound.results.some(a=>a.email.toLowerCase()===email))throw new ApiError(403,'ADMIN_ACCOUNT_CHANGE_REQUIRES_REVIEW');
  }
  const before=await db.prepare('SELECT * FROM main__user_moderation WHERE user_id=?').bind(target).first(),patch={status,note,updated_by:admin.email,updated_at:timestamp};
  const row=await auditMutation(db,admin,'user_status',target,before,patch,db.prepare('INSERT INTO main__user_moderation(user_id,status,note,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at RETURNING *').bind(target,status,note,admin.email,timestamp),note);return{userModeration:row};
 }
 if(resource==='settings'&&action==='update'){
  const key=options(body.key,['content_review_enabled','offer_submit_enabled','report_alert_enabled','operation_log_retention_days']),value=body.value;
  if(key==='operation_log_retention_days'){if(!Number.isInteger(value)||Number(value)<7||Number(value)>3650)throw new ApiError(400,'INVALID_SETTING');}else if(typeof value!=='boolean')throw new ApiError(400,'INVALID_SETTING');
  const before=await db.prepare('SELECT * FROM main__admin_system_settings WHERE key=?').bind(key).first();const patch={value,updated_by:admin.email,updated_at:timestamp};const row=await auditMutation(db,admin,'settings',key,before,patch,db.prepare('INSERT INTO main__admin_system_settings(key,value,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at RETURNING *').bind(key,JSON.stringify(value),admin.email,timestamp),'');return{setting:parse(row as Record<string,unknown>)};
 }
 throw new ApiError(501,'ROUTE_NOT_YET_MIGRATED');
}
