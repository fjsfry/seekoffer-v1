import {ApiError} from './auth.ts';
import {boundedBody} from './index.ts';

export const publicPost="p.review_status='approved' AND p.hidden_at IS NULL AND p.deleted_at IS NULL";
const results=['录取','放弃','候补','补录传闻','官方确认'];
const projects=['夏令营','预推免','九推','直博','硕士','博士','其他'];
const categories=['选校定位','材料准备','导师联系','面试经验','Offer选择','候补动态','其他'];
const postColumns=`p.id,p.content_type,p.title,p.category,CASE WHEN p.is_anonymous=1 AND p.is_official=0 THEN '' ELSE p.author_name END AS author_name,p.school_name,p.major,p.project_type,p.result,p.undergraduate_background,p.content,p.is_anonymous,p.is_official,p.source_label,p.reports_count,p.created_at,
 (SELECT count(*) FROM main__offer_comments c WHERE c.post_id=p.id AND c.review_status='approved' AND c.hidden_at IS NULL AND c.deleted_at IS NULL) AS comments_count,
 (SELECT count(*) FROM main__offer_post_follows f WHERE f.post_id=p.id) AS follows_count`;
function only(body:Record<string,unknown>,keys:string[]){if(Object.keys(body).some(k=>!keys.includes(k)))throw new ApiError(400,'UNSUPPORTED_FIELD');}
function text(value:unknown,max:number,min=0){if(typeof value!=='string')throw new ApiError(400,'INVALID_TEXT');const s=value.trim();if(s.length<min||s.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s))throw new ApiError(400,'INVALID_TEXT');return s;}
function id(value:unknown){const s=text(value,180,1);if(/[\u0000-\u001f]/.test(s))throw new ApiError(400,'INVALID_ID');return s;}
function requestId(value:unknown){const s=id(value);if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s))throw new ApiError(400,'INVALID_REQUEST_ID');return s;}
function bool(value:unknown){if(typeof value!=='boolean')throw new ApiError(400,'INVALID_BOOLEAN');return value?1:0;}
function choice(value:unknown,values:string[]){if(typeof value!=='string'||!values.includes(value))throw new ApiError(400,'INVALID_OPTION');return value;}
function number(value:string|null,fallback:number,max:number){const n=value===null?fallback:Number(value);if(!Number.isSafeInteger(n)||n<1||n>max)throw new ApiError(400,'INVALID_PAGE');return n;}
function toPublic(row:Record<string,unknown>){return{...row,is_anonymous:row.is_anonymous===1,is_official:row.is_official===1};}
async function requirePost(db:D1Database,postId:string){if(!await db.prepare('SELECT p.id FROM main__offer_posts p WHERE p.id=? AND '+publicPost).bind(postId).first())throw new ApiError(404,'POST_UNAVAILABLE');}
async function allowedToSubmit(db:D1Database,owner:string){
 const state=await db.prepare('SELECT status FROM main__user_moderation WHERE user_id=?').bind(owner).first<{status:string}>();if(state&&state.status!=='active')throw new ApiError(403,'ACCOUNT_RESTRICTED');
 const setting=await db.prepare("SELECT value FROM main__admin_system_settings WHERE key='offer_submit_enabled'").first<{value:string}>();if(setting&&JSON.parse(setting.value)===false)throw new ApiError(503,'COMMUNITY_SUBMISSIONS_PAUSED');
}
function same(row:Record<string,unknown>,owner:string,values:Record<string,unknown>){return row.user_id===owner&&Object.entries(values).every(([k,v])=>row[k]===v);}

export async function readCommunity(db:D1Database,path:string,params:URLSearchParams){
 if(path==='/v1/community/posts'){
  if([...params.keys()].some(k=>params.getAll(k).length!==1||!['page','pageSize','q','type','result','category'].includes(k)))throw new ApiError(400,'INVALID_FILTER');
  const page=number(params.get('page'),1,100000),pageSize=number(params.get('pageSize'),16,40),terms=[publicPost],values:unknown[]=[];
  for(const [key,column,options]of [['type','content_type',['offer','discussion']],['result','result',results],['category','category',categories]] as const){const v=params.get(key);if(v){terms.push('p.'+column+'=?');values.push(choice(v,[...options]));}}
  const keyword=params.get('q');if(keyword){terms.push("instr(lower(coalesce(p.title,'')||' '||coalesce(p.school_name,'')||' '||coalesce(p.major,'')||' '||coalesce(p.content,'')||' '||coalesce(p.category,'')||' '||coalesce(p.project_type,'')||' '||coalesce(p.result,'')),lower(?))>0");values.push(text(keyword,80));}
  const where=terms.join(' AND '),count=await db.prepare('SELECT count(*) AS n FROM main__offer_posts p WHERE '+where).bind(...values).first<{n:number}>();
  const rows=await db.prepare('SELECT '+postColumns+' FROM main__offer_posts p WHERE '+where+' ORDER BY p.created_at DESC,p.id DESC LIMIT ? OFFSET ?').bind(...values,pageSize,(page-1)*pageSize).all<Record<string,unknown>>();
  const metrics=await db.prepare("SELECT sum(p.content_type='offer') AS offers,sum(p.content_type='discussion') AS discussions,sum(p.created_at>=?) AS recent,count(distinct nullif(nullif(p.school_name,''),'通用讨论')) AS schools FROM main__offer_posts p WHERE "+publicPost).bind(new Date(Date.now()-7*86400000).toISOString()).first<Record<string,number>>();
  return{items:rows.results.map(toPublic),metrics:Object.fromEntries(Object.entries(metrics||{}).map(([k,v])=>[k,v||0])),pagination:{page,pageSize,total:count!.n,totalPages:Math.max(1,Math.ceil(count!.n/pageSize))}};
 }
 if(path==='/v1/community/comments'){
  const postId=id(params.get('postId'));await requirePost(db,postId);const page=number(params.get('page'),1,100000),size=40;
  const rows=await db.prepare("SELECT c.id,c.post_id,CASE WHEN c.is_anonymous=1 THEN '' ELSE c.author_name END AS author_name,c.content,c.is_anonymous,c.created_at FROM main__offer_comments c WHERE c.post_id=? AND c.review_status='approved' AND c.hidden_at IS NULL AND c.deleted_at IS NULL ORDER BY c.created_at,c.id LIMIT ? OFFSET ?").bind(postId,size+1,(page-1)*size).all<Record<string,unknown>>();
  return{items:rows.results.slice(0,size).map(toPublic),nextPage:rows.results.length>size?page+1:null};
 }
 throw new ApiError(404,'ROUTE_NOT_FOUND');
}

export async function communityOwnerAction(db:D1Database,owner:string,path:string,request:Request){
 if(path==='/v1/me/community/follows'&&request.method==='GET'){
  const page=number(new URL(request.url).searchParams.get('page'),1,100000),size=100;
  const rows=await db.prepare('SELECT f.post_id FROM main__offer_post_follows f JOIN main__offer_posts p ON p.id=f.post_id WHERE f.user_id=? AND '+publicPost+' ORDER BY f.post_id LIMIT ? OFFSET ?').bind(owner,size+1,(page-1)*size).all<{post_id:string}>();return{ids:rows.results.slice(0,size).map(r=>r.post_id),nextPage:rows.results.length>size?page+1:null};
 }
 if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
 const body=await boundedBody(request,16384);await allowedToSubmit(db,owner);
 if(path==='/v1/me/community/posts'){
  only(body,['requestId','contentType','authorName','schoolName','major','projectType','result','undergraduateBackground','content','isAnonymous','title','category']);
  const key=requestId(body.requestId),kind=choice(body.contentType,['offer','discussion']);
  const payload={content_type:kind,author_name:text(body.authorName,80,1),school_name:text(body.schoolName,80,1),major:text(body.major,80,1),project_type:kind==='offer'?choice(body.projectType,projects):'',result:kind==='offer'?choice(body.result,results):'',undergraduate_background:kind==='offer'?text(body.undergraduateBackground,120,1):'',content:text(body.content,1200,12),is_anonymous:bool(body.isAnonymous),title:kind==='discussion'?text(body.title,120,4):'',category:kind==='discussion'?choice(body.category,categories):''};
  const columns=Object.keys(payload);const existing=await db.prepare('SELECT user_id,review_status,'+columns.join(',')+' FROM main__offer_posts WHERE id=?').bind(key).first<Record<string,unknown>>();
  if(existing){if(!same(existing,owner,payload))throw new ApiError(409,'IDEMPOTENCY_CONFLICT');return{id:key,reviewStatus:existing.review_status};}
  const created=await db.prepare('INSERT INTO main__offer_posts(id,user_id,'+columns.join(',')+") SELECT "+[key,owner,...Object.values(payload)].map(()=>'?').join(',')+" WHERE (SELECT count(*) FROM main__offer_posts WHERE user_id=? AND created_at>=?)<5 ON CONFLICT(id) DO NOTHING RETURNING id,review_status").bind(key,owner,...Object.values(payload),owner,new Date(Date.now()-3600000).toISOString()).first<{id:string;review_status:string}>();
  if(!created){const concurrent=await db.prepare('SELECT user_id,review_status,'+columns.join(',')+' FROM main__offer_posts WHERE id=?').bind(key).first<Record<string,unknown>>();if(concurrent&&same(concurrent,owner,payload))return{id:key,reviewStatus:concurrent.review_status};throw new ApiError(429,'SUBMISSION_RATE_LIMIT');}
  return{id:created.id,reviewStatus:created.review_status};
 }
 if(path==='/v1/me/community/comments'){
  only(body,['requestId','postId','authorName','content','isAnonymous']);const key=requestId(body.requestId),postId=id(body.postId);await requirePost(db,postId);
  const payload={post_id:postId,author_name:text(body.authorName,80,1),content:text(body.content,800,2),is_anonymous:bool(body.isAnonymous)};
  const existing=await db.prepare('SELECT user_id,post_id,author_name,content,is_anonymous FROM main__offer_comments WHERE id=?').bind(key).first<Record<string,unknown>>();if(existing){if(!same(existing,owner,payload))throw new ApiError(409,'IDEMPOTENCY_CONFLICT');return{id:key,reviewStatus:'approved'};}
  const batch=await db.batch([db.prepare("INSERT INTO main__offer_comments(id,user_id,post_id,author_name,content,is_anonymous) SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM main__offer_comments WHERE user_id=? AND created_at>=?)<20 AND EXISTS(SELECT 1 FROM main__offer_posts p WHERE p.id=? AND "+publicPost+') ON CONFLICT(id) DO NOTHING RETURNING id').bind(key,owner,postId,payload.author_name,payload.content,payload.is_anonymous,owner,new Date(Date.now()-3600000).toISOString(),postId),db.prepare("UPDATE main__offer_posts SET comments_count=(SELECT count(*) FROM main__offer_comments c WHERE c.post_id=? AND c.review_status='approved' AND c.hidden_at IS NULL AND c.deleted_at IS NULL) WHERE id=? AND changes()>0").bind(postId,postId)]);
  if(!batch[0].results.length){const concurrent=await db.prepare('SELECT user_id,post_id,author_name,content,is_anonymous FROM main__offer_comments WHERE id=?').bind(key).first<Record<string,unknown>>();if(!concurrent||!same(concurrent,owner,payload)){await requirePost(db,postId);throw new ApiError(429,'SUBMISSION_RATE_LIMIT');}}return{id:key,reviewStatus:'approved'};
 }
 if(path==='/v1/me/community/follows'){
  only(body,['postId','follow']);const postId=id(body.postId),follow=bool(body.follow);if(follow)await requirePost(db,postId);const change=follow?db.prepare('INSERT INTO main__offer_post_follows(post_id,user_id) VALUES(?,?) ON CONFLICT DO NOTHING').bind(postId,owner):db.prepare('DELETE FROM main__offer_post_follows WHERE post_id=? AND user_id=?').bind(postId,owner);await db.batch([change,db.prepare('UPDATE main__offer_posts SET follows_count=(SELECT count(*) FROM main__offer_post_follows WHERE post_id=?) WHERE id=? AND changes()>0').bind(postId,postId)]);return{followed:Boolean(follow)};
 }
 throw new ApiError(404,'ROUTE_NOT_FOUND');
}

export async function submitCommunityReport(db:D1Database,body:Record<string,unknown>,owner:string|null,anonymousKey?:string){
 only(body,['requestId','postId','content']);const postId=id(body.postId),content=text(body.content,800,8);await requirePost(db,postId);
 const key=owner?requestId(body.requestId):id(anonymousKey);
 const old=await db.prepare('SELECT user_id,target_id,content FROM main__feedback_reports WHERE id=?').bind(key).first<Record<string,unknown>>();if(old){if(old.user_id!==owner||old.target_id!==postId||old.content!==content)throw new ApiError(429,'SUBMISSION_RATE_LIMIT');return{id:key};}
 const since=new Date(Date.now()-(owner?3600000:86400000)).toISOString(),limit=owner?5:100;
 const batch=await db.batch([db.prepare("INSERT INTO main__feedback_reports(id,user_id,type,module,target_id,content) SELECT ?,?,'report','offer',?,? WHERE (SELECT count(*) FROM main__feedback_reports WHERE user_id IS ? AND created_at>=?)<? ON CONFLICT(id) DO NOTHING RETURNING id").bind(key,owner,postId,content,owner,since,limit),db.prepare("UPDATE main__offer_posts SET reports_count=(SELECT count(*) FROM main__feedback_reports WHERE type='report' AND module='offer' AND target_id=?) WHERE id=? AND changes()>0").bind(postId,postId)]);
 if(!batch[0].results.length){const concurrent=await db.prepare('SELECT user_id,target_id,content FROM main__feedback_reports WHERE id=?').bind(key).first<Record<string,unknown>>();if(!concurrent||concurrent.user_id!==owner||concurrent.target_id!==postId||concurrent.content!==content)throw new ApiError(429,'SUBMISSION_RATE_LIMIT');}return{id:key};
}
