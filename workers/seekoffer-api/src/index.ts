import { ApiError, resolveOwner, verifyIdentity, type AuthConfig } from './auth.ts';
export interface Env extends AuthConfig { CORE:D1Database;MODE:string;LEGACY_PROJECT_REF:string;ALLOWED_ORIGINS:string;PREVIEW_ACCESS_TOKEN?:string; }
const publicColumns=['id','schoolName','departmentName','projectName','projectType','discipline','publishDate','deadlineDate','deadlineLevel','tags','status','year','sourceSite','sourceLink','applyLink','collectedAt','updatedAt','isVerified'];
const detailColumns=[...publicColumns,'eventStartDate','eventEndDate','requirements','materialsRequired','examInterviewInfo','contactInfo'];
const projectScopes=['mnotoltpythkayguhnrk','bqzchxacykhdmoczysfe'];
const headers={'Cache-Control':'no-store','Content-Type':'application/json;charset=utf-8'};
function projectPublic(value:string,detail=false){const row=JSON.parse(value);return Object.fromEntries((detail?detailColumns:publicColumns).filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]));}
function text(params:URLSearchParams,key:string,max=80){const value=params.get(key)||'';if([...value].length>max||/[\u0000-\u001f]/.test(value))throw new ApiError(400,'INVALID_FILTER');return value;}
function integer(params:URLSearchParams,key:string,fallback:number,max:number){const value=params.get(key);if(value===null)return fallback;const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>max)throw new ApiError(400,'INVALID_PAGE');return n;}
export async function boundedBody(request:Request,max=64*1024):Promise<Record<string,unknown>>{
  if(Number(request.headers.get('content-length')||0)>max)throw new ApiError(413,'PAYLOAD_TOO_LARGE');
  const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'BODY_REQUIRED');let bytes=0;const chunks:Uint8Array[]=[];
  for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>max){await reader.cancel();throw new ApiError(413,'PAYLOAD_TOO_LARGE');}chunks.push(value);}
  const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  try{const parsed=JSON.parse(new TextDecoder().decode(data));if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error();return parsed;}catch{throw new ApiError(400,'INVALID_JSON');}
}
function only(body:Record<string,unknown>,keys:string[]){if(Object.keys(body).some(k=>!keys.includes(k)))throw new ApiError(400,'UNSUPPORTED_FIELD');}
function id(value:unknown){if(typeof value!=='string'||!value||value.length>180||/[\u0000-\u001f]/.test(value))throw new ApiError(400,'INVALID_ID');return value;}

const worker = {
  async fetch(request:Request,env:Env):Promise<Response>{
    const requestId=crypto.randomUUID();const origin=request.headers.get('origin');
    const cors:Record<string,string>=origin&&env.ALLOWED_ORIGINS.split(',').includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
    const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{...headers,...cors,'X-Request-ID':requestId}});
    try{
      if(env.MODE==='local'&&!['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname))throw new ApiError(503,'LOCAL_CONFIG_NOT_DEPLOYABLE');
      if(!projectScopes.includes(env.LEGACY_PROJECT_REF))throw new ApiError(503,'SOURCE_SCOPE_NOT_CONFIGURED');
      if(env.MODE!=='local'){
        if(!env.PREVIEW_ACCESS_TOKEN||env.PREVIEW_ACCESS_TOKEN.length<32)throw new ApiError(503,'PREVIEW_AUTH_NOT_CONFIGURED');
        const supplied=request.headers.get('x-preview-access')||'';
        const digest=(s:string)=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));const [a,b]=await Promise.all([digest(supplied),digest(env.PREVIEW_ACCESS_TOKEN)]);let diff=0;new Uint8Array(a).forEach((v,i)=>diff|=v^new Uint8Array(b)[i]);if(diff)throw new ApiError(401,'PREVIEW_ACCESS_REQUIRED');
      }
      if(origin&&!Object.keys(cors).length)throw new ApiError(403,'ORIGIN_NOT_ALLOWED');
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,X-Preview-Access','Cache-Control':'no-store'}});
      const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');const project=env.LEGACY_PROJECT_REF;
      if(path==='/health')return reply({status:'local-prototype',backend:'d1',migrationComplete:false});
      if(path==='/v1/notices'&&request.method==='GET'){
        const page=integer(url.searchParams,'page',1,100_000),pageSize=integer(url.searchParams,'pageSize',16,40);
        const terms=['legacy_project_ref=?','is_private=0',"admin_status='published'",'deleted_at IS NULL','year=?'];const values:unknown[]=[project,2026];
        for(const [key,column]of [['school','school_name'],['region','region'],['type','project_type'],['discipline','discipline'],['range','school_range'],['kind','notice_kind'],['date','publish_date']]){const value=text(url.searchParams,key);if(value&&value!=='全部'){terms.push(column+'=?');values.push(value);}}
        const keyword=text(url.searchParams,'q');if(keyword){terms.push('instr(lower(search_text),lower(?))>0');values.push(keyword);}
        const sort=text(url.searchParams,'sort')||'publish';const sorts:Record<string,string>={publish:'publish_date DESC,id',deadline:'deadline_utc_ms IS NULL,deadline_utc_ms,id',school:'school_name,id'};if(!sorts[sort])throw new ApiError(400,'INVALID_SORT');
        // Prototype covers explicit filters; unsupported legacy filters fail visibly.
        const known=new Set(['page','pageSize','school','region','type','discipline','range','kind','date','q','sort']);if([...url.searchParams.keys()].some(k=>!known.has(k)))throw new ApiError(400,'FILTER_NOT_YET_MIGRATED');
        const where=terms.join(' AND ');const count=await env.CORE.prepare('SELECT count(*) AS n FROM notices WHERE '+where).bind(...values).first<{n:number}>();
        const result=await env.CORE.prepare('SELECT summary_json FROM notices WHERE '+where+' ORDER BY '+sorts[sort]+' LIMIT ? OFFSET ?').bind(...values,pageSize,(page-1)*pageSize).all<{summary_json:string}>();
        return reply({items:result.results.map(r=>projectPublic(r.summary_json)),pagination:{page,pageSize,total:count?.n||0,totalPages:Math.max(1,Math.ceil((count?.n||0)/pageSize))}});
      }
      if(path.startsWith('/v1/notices/')&&request.method==='GET'){
        const row=await env.CORE.prepare("SELECT detail_json FROM notices WHERE legacy_project_ref=? AND id=? AND is_private=0 AND admin_status='published' AND deleted_at IS NULL").bind(project,id(decodeURIComponent(path.slice('/v1/notices/'.length)))).first<{detail_json:string}>();
        if(!row)throw new ApiError(404,'NOTICE_UNAVAILABLE');return reply(projectPublic(row.detail_json,true));
      }
      if(!path.startsWith('/v1/me/'))throw new ApiError(404,'ROUTE_NOT_MIGRATED');
      const authorization=request.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))throw new ApiError(401,'AUTH_REQUIRED');
      const identity=await verifyIdentity(authorization.slice(7),env);const owner=await resolveOwner(env.CORE,identity,project);
      if(path==='/v1/me/applications'&&request.method==='GET'){
        const result=await env.CORE.prepare(`SELECT a.id,a.project_id,a.payload,a.revision,n.summary_json FROM applications a
          LEFT JOIN notices n ON n.legacy_project_ref=a.legacy_project_ref AND n.id=a.project_id
          AND n.deleted_at IS NULL AND ((n.is_private=0 AND n.admin_status='published') OR (n.is_private=1 AND n.owner_id=a.user_id))
          WHERE a.legacy_project_ref=? AND a.user_id=? ORDER BY a.id`).bind(project,owner).all();
        return reply({items:result.results.map(r=>({id:r.id,projectId:r.project_id,payload:JSON.parse(String(r.payload)),revision:r.revision,notice:r.summary_json?projectPublic(String(r.summary_json)):null}))});
      }
      if(path.startsWith('/v1/me/applications/')&&request.method==='PUT'){
        const body=await boundedBody(request);only(body,['expectedRevision','payload']);if(!Number.isSafeInteger(body.expectedRevision)||Number(body.expectedRevision)<1||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload))throw new ApiError(400,'INVALID_REVISION');
        only(body.payload as Record<string,unknown>,['myNotes','myStatus','priorityLevel','materialsProgress','cvReady','transcriptReady','rankingProofReady','recommendationReady','personalStatementReady','contactSupervisorDone','submittedAt','interviewTime','resultStatus','customReminderEnabled']);
        const result=await env.CORE.prepare('UPDATE applications SET payload=json_patch(payload,?),revision=revision+1 WHERE legacy_project_ref=? AND user_id=? AND id=? AND revision=? RETURNING revision').bind(JSON.stringify(body.payload),project,owner,id(decodeURIComponent(path.slice('/v1/me/applications/'.length))),body.expectedRevision).first();
        if(!result)throw new ApiError(409,'REVISION_CONFLICT_OR_NOT_FOUND');return reply(result);
      }
      throw new ApiError(501,'ROUTE_NOT_YET_MIGRATED');
    }catch(error){const status=error instanceof ApiError?error.status:503;return reply({error:error instanceof ApiError?error.message:'SERVICE_UNAVAILABLE',requestId},status);}
  }
};

export default worker;
