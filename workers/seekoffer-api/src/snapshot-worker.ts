import {ApiError,verifyIdentity,verifyNativeOAuth,recentlyVerified,type AuthConfig} from './auth.ts';
import {boundedBody} from './index.ts';
import {noticeSql,cachedCount,publicVisibility} from './notice-sql.ts';
import {liveSummary,type NoticeProjection} from './notice-projection.ts';
import {NOTICE_DETAIL_COLUMNS,mapNoticeRowToProject} from '../../../lib/notice-record';
import {createManualProject} from './manual-project.ts';
import {applyJianPayNotification} from './payments/payment-state.ts';
import {bootstrapIdentity,type BootstrapConfig} from './identity-bootstrap.ts';
import {readCommunity,communityOwnerAction,submitCommunityReport} from './community.ts';
import {requireSnapshotAdmin,adminAction} from './admin.ts';
import {readNoticeOverrides,readOverrideDetail} from './notice-overrides.ts';
import {recoverLegacyApplications} from './legacy-recovery.ts';
import {protectWorkbenchUpdate} from './workbench-compatibility.ts';
import {ingestNotices,requireIngestSecret} from './ingest-notices.ts';
import {billingAction,billingPlans,consumeFill} from './billing.ts';
import {licenseAction} from './license.ts';
import {accountEntitlementAction} from './account-entitlement.ts';
import {commercialAction,type CommercialConfig,type CommercialOwner} from './payments/commercial-api.ts';
import {readClerkUser} from './identity-bootstrap.ts';
import {recordPageview,type AnalyticsConfig} from './analytics.ts';
import {productLink} from './product-links.ts';
import {recordDownload,type DownloadConfig} from './download-analytics.ts';
import {publicationAction,requireWechatLedger,type WechatLedgerConfig} from './wechat-publications.ts';
import {refundAction,type RefundConfig} from './payments/refund-api.ts';
import {accountDeletionAction,type AccountDeletionConfig} from './account-deletion.ts';
import {processAccountDeletion} from './account-deletion-execution.ts';
export interface SnapshotEnv extends AuthConfig,BootstrapConfig,AnalyticsConfig,CommercialConfig {CORE:D1Database;MODE:'local'|'preview'|'production';ALLOWED_ORIGINS:string;PREVIEW_ACCESS_TOKEN?:string;BUSINESS_WRITES_ENABLED?:string;PUBLIC_READ_ENABLED?:string;PAYMENT_PROCESSING_ENABLED?:string;OPERATIONS_WRITES_ENABLED?:string;JIANPAY_CLIENT_NO?:string;JIANPAY_MERCHANT_KEY?:string;INGEST_ENABLED?:string;SEEKOFFER_INGEST_SECRET?:string;NATIVE_OAUTH_CLIENT_ID?:string;EXTENSION_OAUTH_CLIENT_ID?:string;LICENSE_ENABLED?:string;LICENSE_ATTEMPTS_PER_DAY?:string;ACCOUNT_ENTITLEMENT_ENABLED?:string}
const MAIN='mnotoltpythkayguhnrk';
function inputId(value:unknown){if(typeof value!=='string'||!value||value.length>180||/[\u0000-\u001f]/.test(value))throw new ApiError(400,'INVALID_ID');return value;}
function only(body:Record<string,unknown>,keys:readonly string[]){if(Object.keys(body).some(k=>!keys.includes(k)))throw new ApiError(400,'UNSUPPORTED_FIELD');}
const profileFields=['nickname','age','undergraduate_school','major','grade','target_major','target_region'] as const;
const applicationFields=['is_favorited','my_status','priority_level','materials_progress','cv_ready','transcript_ready','ranking_proof_ready','recommendation_ready','personal_statement_ready','contact_supervisor_done','submitted_at','interview_time','result_status','my_notes','custom_reminder_enabled'] as const;
const boolFields=new Set(['is_favorited','cv_ready','transcript_ready','ranking_proof_ready','recommendation_ready','personal_statement_ready','contact_supervisor_done','custom_reminder_enabled']);
function normalizedPatch(input:unknown,allowed:readonly string[]){
  if(!input||Array.isArray(input)||typeof input!=='object')throw new ApiError(400,'INVALID_PATCH');const body=input as Record<string,unknown>;only(body,allowed);
  const entries=Object.entries(body);if(!entries.length)throw new ApiError(400,'EMPTY_PATCH');
  return entries.map(([key,value])=>{
    if(boolFields.has(key)){if(typeof value!=='boolean')throw new ApiError(400,'INVALID_BOOLEAN');return [key,value?1:0] as const;}
    if(key==='materials_progress'){if(!Number.isInteger(value)||Number(value)<0||Number(value)>100)throw new ApiError(400,'INVALID_PROGRESS');return [key,value] as const;}
    if(typeof value!=='string'||value.length>(key==='my_notes'?20000:500))throw new ApiError(400,'INVALID_TEXT');
    return [key,value] as const;
  });
}
function revision(value:unknown){if(!Number.isSafeInteger(value)||Number(value)<1)throw new ApiError(400,'REVISION_REQUIRED');return value;}
function parseRow(row:Record<string,unknown>){const value={...row};for(const k of ['tags','materials_required','encrypted_payload','custom_todos','completed_todo_ids','mentor_contacts'])if(typeof value[k]==='string')value[k]=JSON.parse(value[k] as string);for(const k of boolFields)if(k in value)value[k]=Boolean(value[k]);if('is_verified'in value)value.is_verified=Boolean(value.is_verified);return value;}
export async function resolveSnapshotOwner(db:D1Database,identity:{issuer:string;subject:string},now=Date.now()){
  const row=await db.prepare(`SELECT u.id,u.banned_until,u.deleted_at,u.email_confirmed_at,m.status AS moderation_status
    FROM _identity_links l JOIN main__auth_subjects u ON u.id=l.legacy_user_id
    LEFT JOIN main__user_moderation m ON m.user_id=u.id
    WHERE l.issuer=? AND l.subject=? AND l.legacy_project_ref=?`).bind(identity.issuer,identity.subject,MAIN).first<{id:string;banned_until:string|null;deleted_at:string|null;email_confirmed_at:string|null;moderation_status:string|null}>();
  if(!row)throw new ApiError(403,'IDENTITY_MAPPING_REQUIRED');
  if(row.deleted_at||(row.banned_until&&Date.parse(row.banned_until)>now)||['blocked','banned','disabled','deleted'].includes(row.moderation_status||''))throw new ApiError(403,'ACCOUNT_BLOCKED');
  if(!row.email_confirmed_at)throw new ApiError(403,'EMAIL_VERIFICATION_REQUIRED');
  return row.id;
}
type IdentityVerifier=(token:string,env:AuthConfig)=>Promise<{issuer:string;subject:string}>;
function meterDatabase(db:D1Database,usage:{queries:number;rowsRead:number;rowsWritten:number}){
 const originals=new WeakMap<object,D1PreparedStatement>();
 const record=(result:D1Result)=>{usage.queries++;usage.rowsRead+=Number(result.meta?.rows_read||0);usage.rowsWritten+=Number(result.meta?.rows_written||0);};
 const wrap=(statement:D1PreparedStatement):D1PreparedStatement=>{const wrapped={bind(...args:unknown[]):D1PreparedStatement{return wrap(statement.bind(...args));},async all(){const result=await statement.all();record(result);return result;},async run(){const result=await statement.run();record(result);return result;},async first(column?:string){const result=await statement.all();record(result);const row=result.results[0] as Record<string,unknown>|undefined;return column?row?.[column]??null:row??null;}};originals.set(wrapped,statement);return wrapped as unknown as D1PreparedStatement;};
 return {prepare(sql:string){return wrap(db.prepare(sql));},async batch(statements:D1PreparedStatement[]){const raw=statements.map(s=>{const original=originals.get(s);if(!original)throw new ApiError(503,'FOREIGN_BATCH_STATEMENT');return original;});const results=await db.batch(raw);results.forEach(record);return results;}
 } as unknown as D1Database;
}
export function createSnapshotWorker(verifier:IdentityVerifier=verifyIdentity,clerkFetch:typeof fetch=fetch){
 return {async fetch(request:Request,env:SnapshotEnv):Promise<Response>{
  const usage={queries:0,rowsRead:0,rowsWritten:0};env={...env,CORE:meterDatabase(env.CORE,usage)};
  let previewIdentity:{issuer:string;subject:string}|null=null;
  const requestId=crypto.randomUUID(),url=new URL(request.url),origin=request.headers.get('origin');
  const clientKind=request.headers.get('x-seekoffer-client');
  const identify=(token:string)=>clientKind==='desktop-pkce'||clientKind==='extension-pkce'?verifyNativeOAuth(token,env,clerkFetch,clientKind==='extension-pkce'?'extension':'desktop'):verifier(token,env);
  // This existing capability operation is used from arbitrary university forms.
  // It accepts only a five-minute, single-use fill token; it returns no identity/data.
  const fillCapability=url.pathname.replace(/\/$/,'')==='/v1/billing/consume';
  const licenseOrigin=url.pathname.replace(/\/$/,'')==='/v1/license-entitlement'&&Boolean(origin&&/^chrome-extension:\/\/[a-p]{32}$/.test(origin));
  const extensionOrigin=Boolean(origin&&/^chrome-extension:\/\/[a-p]{32}$/.test(origin)&&(clientKind==='extension-pkce'||request.method==='OPTIONS'&&request.headers.get('access-control-request-headers')?.toLowerCase().includes('x-seekoffer-client')));
  const allowed=env.ALLOWED_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean);const cors:Record<string,string>=origin&&(allowed.includes(origin)||fillCapability||licenseOrigin||extensionOrigin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Expose-Headers':'X-Request-ID,X-D1-Queries,X-D1-Rows-Read,X-D1-Rows-Written',Vary:'Origin'}:{};
  const response=(body:unknown,status=200,extra:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Request-ID':requestId,'X-D1-Queries':String(usage.queries),'X-D1-Rows-Read':String(usage.rowsRead),'X-D1-Rows-Written':String(usage.rowsWritten),...cors,...extra}});
  try{
   if(!['local','preview','production'].includes(env.MODE))throw new ApiError(503,'MODE_NOT_CONFIGURED');
   if(env.MODE==='local'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new ApiError(503,'LOCAL_ONLY');
   if(origin&&!allowed.includes(origin)&&!fillCapability&&!licenseOrigin&&!extensionOrigin)throw new ApiError(403,'ORIGIN_NOT_ALLOWED');
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Cache-Control':'no-store','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,X-Preview-Access,X-Seekoffer-Client'}});
   if(env.MODE==='preview'){
    if(!env.PREVIEW_ACCESS_TOKEN||env.PREVIEW_ACCESS_TOKEN.length<32)throw new ApiError(503,'PREVIEW_AUTH_NOT_CONFIGURED');
    const hash=(s:string)=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));const [a,b]=await Promise.all([hash(request.headers.get('x-preview-access')||''),hash(env.PREVIEW_ACCESS_TOKEN)]);let difference=0;new Uint8Array(a).forEach((n,i)=>difference|=n^new Uint8Array(b)[i]);
    if(difference){
     const bearer=request.headers.get('authorization')||'';
     if(url.origin!=='https://migration.seekoffer.com.cn'||!url.pathname.startsWith('/v1/me/')||!bearer.startsWith('Bearer '))throw new ApiError(401,'PREVIEW_ACCESS_REQUIRED');
     previewIdentity=await identify(bearer.slice(7));
    }
   }
   const path=url.pathname.replace(/\/$/,'').replace(/^\/api\/public\/notices/,'/v1/notices');
   if(path==='/v1/internal/wechat-publications'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    if(origin||env.MODE==='preview'||env.BUSINESS_WRITES_ENABLED!=='true')throw new ApiError(403,'SERVER_JOB_ONLY');
    await requireWechatLedger(request,env as SnapshotEnv&WechatLedgerConfig);
    return response(await publicationAction(env.CORE,await boundedBody(request,524288)));
   }
   if(path==='/v1/desktop-download-attempt'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    if(!origin||!allowed.includes(origin))throw new ApiError(403,'ORIGIN_NOT_ALLOWED');
    if(env.MODE==='preview'||env.BUSINESS_WRITES_ENABLED!=='true')throw new ApiError(503,'DOWNLOAD_ANALYTICS_MAINTENANCE');
    return response(await recordDownload(env.CORE,await boundedBody(request,1024),env as SnapshotEnv&DownloadConfig));
   }
   if(path==='/v1/analytics'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    if(!origin||!allowed.includes(origin))throw new ApiError(403,'ORIGIN_NOT_ALLOWED');
    if(env.MODE==='preview'||env.BUSINESS_WRITES_ENABLED!=='true')throw new ApiError(503,'ANALYTICS_MAINTENANCE');
    return response(await recordPageview(env.CORE,await boundedBody(request,8192),env));
   }
   if(path==='/v1/product-link'){
    if(!['GET','HEAD'].includes(request.method))throw new ApiError(405,'METHOD_NOT_ALLOWED');
    const link=await productLink(env.CORE,request,env.PAYMENT_PROCESSING_ENABLED==='true'&&env.PAYMENT_CHECKOUT_ENABLED==='true');
    if(url.searchParams.get('format')!=='json'&&link.enabled&&link.destinationUrl)return new Response(null,{status:302,headers:Object.fromEntries([...response(null).headers,['Location',link.destinationUrl],['Referrer-Policy','no-referrer']])});
    const result=response(link);return request.method==='HEAD'?new Response(null,{status:result.status,headers:result.headers}):result;
   }
   if(path==='/v1/internal/ingest-notices'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    if(env.MODE==='preview'||env.BUSINESS_WRITES_ENABLED!=='true'||env.INGEST_ENABLED!=='true')throw new ApiError(503,'INGEST_MAINTENANCE');
    await requireIngestSecret(request,env.SEEKOFFER_INGEST_SECRET);
    return response(await ingestNotices(env.CORE,await boundedBody(request,524288)));
   }
   if(env.PUBLIC_READ_ENABLED==='false'&&path.startsWith('/v1/notices'))throw new ApiError(503,'PUBLIC_DATA_SERVED_BY_WEBSITE');
   if(path==='/v1/payments/jianpay/notify'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    if(env.MODE==='preview'||env.PAYMENT_PROCESSING_ENABLED!=='true'||env.BUSINESS_WRITES_ENABLED!=='true')throw new ApiError(503,'PAYMENT_PROCESSING_DISABLED');
    if(!env.JIANPAY_CLIENT_NO||!env.JIANPAY_MERCHANT_KEY)throw new ApiError(503,'PAYMENT_CONFIGURATION_PENDING');
    await applyJianPayNotification(env.CORE,await boundedBody(request,16384),{clientNo:env.JIANPAY_CLIENT_NO,merchantKey:env.JIANPAY_MERCHANT_KEY});
    const headers=new Headers(response(null).headers);headers.set('Content-Type','text/plain; charset=utf-8');return new Response('success',{status:200,headers});
   }
   if(path==='/v1/commercial-order'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    const body=await boundedBody(request,4096);
    if(body.action!=='status'&&(env.MODE==='preview'||env.BUSINESS_WRITES_ENABLED!=='true'||env.PAYMENT_PROCESSING_ENABLED!=='true'||env.PAYMENT_CHECKOUT_ENABLED!=='true'))throw new ApiError(503,'NEW_PURCHASES_DISABLED');
    if(body.action!=='status'&&(!origin||!allowed.includes(origin)))throw new ApiError(403,'ORIGIN_NOT_ALLOWED');
    const bearer=request.headers.get('authorization');let owner:CommercialOwner|null=null;
    if(bearer){if(!bearer.startsWith('Bearer '))throw new ApiError(401,'AUTH_REQUIRED');const identity=await identify(bearer.slice(7));const userId=await resolveSnapshotOwner(env.CORE,identity);let email='';
     if(body.action==='create_account'){const user=await readClerkUser(identity,env,clerkFetch);email=user.email_addresses.find(e=>e.id===user.primary_email_address_id)?.email_address||'';}
     owner={userId,verifiedEmail:email,sourceRef:MAIN};
    }
    return response(await commercialAction(env.CORE,body,owner,env,origin||'',clerkFetch));
   }
   if(path==='/v1/license-entitlement'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');if(env.MODE==='preview'||env.BUSINESS_WRITES_ENABLED!=='true'||env.LICENSE_ENABLED!=='true')throw new ApiError(503,'LICENSE_MAINTENANCE');
    const body=await boundedBody(request,4096),ip=env.MODE==='local'?'synthetic-local':request.headers.get('cf-connecting-ip');if(!ip)throw new ApiError(503,'LICENSE_GUARD_UNAVAILABLE');
    const result=await licenseAction(env.CORE,body,env.PREVIEW_ACCESS_TOKEN,ip,Number(env.LICENSE_ATTEMPTS_PER_DAY||100));return response(result,['activate','renew'].includes(String(body.action))&&!result.active?400:200);
   }
   if(path==='/health')return response({backend:'d1',mode:env.MODE,migrationComplete:false,businessWritesEnabled:env.BUSINESS_WRITES_ENABLED==='true'});
   if(path==='/v1/billing/plans'){if(request.method!=='GET')throw new ApiError(405,'METHOD_NOT_ALLOWED');return response(await billingPlans(env.CORE));}
   if(path==='/v1/billing/consume'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    if(env.MODE==='preview'||env.BUSINESS_WRITES_ENABLED!=='true')throw new ApiError(503,'MIGRATION_READ_ONLY');
    return response(await consumeFill(env.CORE,await boundedBody(request,1024)));
   }
   if(path==='/v1/public/notice-overrides'&&request.method==='GET')return response(await readNoticeOverrides(env.CORE,url.searchParams));
   if(path==='/v1/public/notice-detail'&&request.method==='GET')return response(await readOverrideDetail(env.CORE,url.searchParams.get('id')||''));
   if(path==='/v1/community/posts'||path==='/v1/community/comments'){
    if(request.method!=='GET')throw new ApiError(405,'METHOD_NOT_ALLOWED');return response(await readCommunity(env.CORE,path,url.searchParams));
   }
   if(path==='/v1/community/report'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    if(env.BUSINESS_WRITES_ENABLED!=='true'||env.MODE==='preview'||(env.MODE!=='local'&&env.OPERATIONS_WRITES_ENABLED!=='true'))throw new ApiError(503,'OPERATIONS_MAINTENANCE');
    const bearer=request.headers.get('authorization');let owner:string|null=null,anonymousKey:string|undefined;
    if(bearer){if(!bearer.startsWith('Bearer '))throw new ApiError(401,'AUTH_REQUIRED');owner=await resolveSnapshotOwner(env.CORE,await identify(bearer.slice(7)));}
    else{
     const ip=env.MODE==='local'?'synthetic-local-ip':request.headers.get('cf-connecting-ip');if(!ip||!env.PREVIEW_ACCESS_TOKEN)throw new ApiError(503,'REPORT_GUARD_UNAVAILABLE');
     const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.PREVIEW_ACCESS_TOKEN),{name:'HMAC',hash:'SHA-256'},false,['sign']);const hash=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('community-report:'+ip+':'+new Date().toISOString().slice(0,13))));anonymousKey='report-'+[...hash].map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    return response(await submitCommunityReport(env.CORE,await boundedBody(request,4096),owner,anonymousKey));
   }
   if(path==='/v1/admin/account-deletions'){
    if(!['GET','POST'].includes(request.method))throw new ApiError(405,'METHOD_NOT_ALLOWED');
    const bearer=request.headers.get('authorization')||'';if(!bearer.startsWith('Bearer '))throw new ApiError(401,'AUTH_REQUIRED');
    const identity=await identify(bearer.slice(7)),owner=await resolveSnapshotOwner(env.CORE,identity),admin=await requireSnapshotAdmin(env.CORE,owner,identity,env,clerkFetch);
    if(admin.role!=='super_admin')throw new ApiError(403,'SUPER_ADMIN_REQUIRED');
    if(request.method==='GET'){
     if((env as SnapshotEnv&AccountDeletionConfig).ACCOUNT_DELETION_REQUESTS_ENABLED!=='true')throw new ApiError(503,'ACCOUNT_DELETION_MAINTENANCE');
     const after=url.searchParams.get('after')||'';
     if([...url.searchParams.keys()].some(k=>k!=='after')||after&&!/^[0-9a-f-]{36}$/i.test(after))throw new ApiError(400,'INVALID_CURSOR');
     const rows=await env.CORE.prepare('SELECT request_id AS requestId,legacy_user_id AS userId,state,requested_at AS requestedAt FROM _account_deletion_requests WHERE request_id>? ORDER BY request_id LIMIT 21').bind(after).all<{requestId:string;userId:string;state:string;requestedAt:string}>();
     return response({items:rows.results.slice(0,20),nextCursor:rows.results.length>20?rows.results[19].requestId:null});
    }
    if(env.MODE==='preview'||env.BUSINESS_WRITES_ENABLED!=='true'||env.MODE!=='local'&&env.OPERATIONS_WRITES_ENABLED!=='true')throw new ApiError(503,'ACCOUNT_DELETION_EXECUTION_DISABLED');
    return response(await processAccountDeletion(env.CORE,await boundedBody(request,1024),{role:admin.role,recentlyVerified:recentlyVerified(identity)},env,clerkFetch));
   }
   if(path==='/v1/admin/refunds'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    const bearer=request.headers.get('authorization')||'';if(!bearer.startsWith('Bearer '))throw new ApiError(401,'AUTH_REQUIRED');
    const identity=await identify(bearer.slice(7)),owner=await resolveSnapshotOwner(env.CORE,identity);
    const admin=await requireSnapshotAdmin(env.CORE,owner,identity,env,clerkFetch),body=await boundedBody(request,4096);
    if(body.action!=='status'&&(env.MODE==='preview'||env.BUSINESS_WRITES_ENABLED!=='true'||env.OPERATIONS_WRITES_ENABLED!=='true'&&env.MODE!=='local'))throw new ApiError(503,'REFUNDS_DISABLED');
    return response(await refundAction(env.CORE,body,{userId:owner,role:admin.role,recentlyVerified:recentlyVerified(identity)},env as SnapshotEnv&RefundConfig,clerkFetch));
   }
   if(path==='/v1/admin'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');const bearer=request.headers.get('authorization')||'';if(!bearer.startsWith('Bearer '))throw new ApiError(401,'AUTH_REQUIRED');const identity=await identify(bearer.slice(7)),owner=await resolveSnapshotOwner(env.CORE,identity);
    const admin=await requireSnapshotAdmin(env.CORE,owner,identity,env,clerkFetch);return response(await adminAction(env.CORE,admin,await boundedBody(request,100000),env.MODE!=='preview'&&env.BUSINESS_WRITES_ENABLED==='true'&&(env.MODE==='local'||env.OPERATIONS_WRITES_ENABLED==='true'),env,clerkFetch));
   }
   if(path==='/v1/notices'&&request.method==='GET'){
    const now=Date.now(),query=noticeSql(url.searchParams,now),count=await cachedCount(env.CORE,query,now);const totalPages=Math.max(1,Math.ceil(count.total/query.pageSize)),page=Math.min(query.page,totalPages);
    const result=await env.CORE.prepare('SELECT n.catalog_projection FROM main__notices n WHERE '+query.where+' ORDER BY '+query.order+' LIMIT ? OFFSET ?').bind(...query.values,query.pageSize,(page-1)*query.pageSize).all<{catalog_projection:string}>();
    return response({items:result.results.map(r=>liveSummary(JSON.parse(r.catalog_projection),now)),pagination:{page,pageSize:query.pageSize,total:count.total,totalPages},source:'d1',servedAt:new Date(now).toISOString()},200,{'X-Notice-Version':count.version,'X-Count-Cache':count.cache});
   }
   if(path==='/v1/notices/by-ids'&&request.method==='POST'){
    const body=await boundedBody(request,32768);only(body,['ids']);if(!Array.isArray(body.ids)||body.ids.length>100)throw new ApiError(400,'ID_BATCH_LIMIT');const ids=[...new Set(body.ids.map(inputId))];if(!ids.length)return response({items:[],source:'d1'});
    const rows=await env.CORE.prepare('SELECT n.catalog_projection FROM main__notices n WHERE '+publicVisibility+' AND n.catalog_projection IS NOT NULL AND n.id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all<{catalog_projection:string}>();return response({items:rows.results.map(r=>liveSummary(JSON.parse(r.catalog_projection))),source:'d1'});
   }
   if(path.startsWith('/v1/notices/')&&request.method==='GET'){
    const id=inputId(path==='/v1/notices/detail'?url.searchParams.get('id'):decodeURIComponent(path.slice('/v1/notices/'.length)));
    const row=await env.CORE.prepare('SELECT '+NOTICE_DETAIL_COLUMNS+' FROM main__notices n WHERE n.id=? AND '+publicVisibility).bind(id).first<Record<string,unknown>>();if(!row)throw new ApiError(404,'NOTICE_UNAVAILABLE');return response(mapNoticeRowToProject(parseRow(row)));
   }
   if(!path.startsWith('/v1/me/'))throw new ApiError(501,'ROUTE_NOT_YET_MIGRATED');
   const bearer=request.headers.get('authorization')||'';if(!bearer.startsWith('Bearer '))throw new ApiError(401,'AUTH_REQUIRED');
   const identity=previewIdentity||await identify(bearer.slice(7));
   if(path==='/v1/me/bootstrap'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    if(env.MODE==='preview'||env.BUSINESS_WRITES_ENABLED!=='true')throw new ApiError(503,'MIGRATION_READ_ONLY');
    only(await boundedBody(request,128),[]);
    const result=await bootstrapIdentity(env.CORE,identity,env,clerkFetch);
    const owner=await resolveSnapshotOwner(env.CORE,identity);
    if(owner!==result.userId)throw new ApiError(409,'IDENTITY_MAPPING_INCOMPLETE');
    return response({ready:true},200);
   }
   const owner=await resolveSnapshotOwner(env.CORE,identity);
   if(path==='/v1/me/account-deletion'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    const body=await boundedBody(request,1024);
    if(body.action==='request'&&(env.MODE==='preview'||env.BUSINESS_WRITES_ENABLED!=='true'))throw new ApiError(503,'MIGRATION_READ_ONLY');
    return response(await accountDeletionAction(env.CORE,owner,identity,body,env as SnapshotEnv&AccountDeletionConfig,clerkFetch));
   }
   if(path==='/v1/me/autofill-entitlement'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    // Code-based licenses and account grants have separate production cutover flags.
    return response(await accountEntitlementAction(env.CORE,owner,await boundedBody(request,2048),env.MODE!=='preview'&&env.BUSINESS_WRITES_ENABLED==='true'&&env.ACCOUNT_ENTITLEMENT_ENABLED==='true'));
   }
   if(path==='/v1/me/billing'){if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');return response(await billingAction(env.CORE,owner,await boundedBody(request,4096),env.MODE!=='preview'&&env.BUSINESS_WRITES_ENABLED==='true'));}
   // This POST is a bounded read, including in read-only preview mode. One bind is
   // reserved for ownership; D1 allows 100 bound parameters in a statement.
   if(path==='/v1/me/notices/by-ids'&&request.method==='POST'){
    const body=await boundedBody(request,32768);only(body,['ids']);
    if(!Array.isArray(body.ids)||body.ids.length>99)throw new ApiError(400,'ID_BATCH_LIMIT');
    const ids=[...new Set(body.ids.map(inputId))];if(!ids.length)return response({items:[],unavailableIds:[]});
    const rows=await env.CORE.prepare('SELECT '+NOTICE_DETAIL_COLUMNS.split(',').map(c=>'n.'+c).join(',')+
     ' FROM main__applications a JOIN main__notices n ON n.id=a.project_id WHERE a.user_id=? AND n.id IN ('+ids.map(()=>'?').join(',')+') AND (('+publicVisibility+') OR (n.is_private=1 AND n.created_by=a.user_id AND n.admin_deleted_at IS NULL))')
     .bind(owner,...ids).all<Record<string,unknown>>();
    const found=new Set(rows.results.map(r=>String(r.id)));
    return response({items:rows.results.map(r=>mapNoticeRowToProject(parseRow(r))),unavailableIds:ids.filter(id=>!found.has(id))});
   }
   if(request.method!=='GET'&&env.BUSINESS_WRITES_ENABLED!=='true')throw new ApiError(503,'MIGRATION_READ_ONLY');
   if(path==='/v1/me/legacy-applications'){
    if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED');
    if(env.MODE==='preview')throw new ApiError(503,'MIGRATION_READ_ONLY');
    return response(await recoverLegacyApplications(env.CORE,owner,await boundedBody(request,262144)));
   }
   if(path.startsWith('/v1/me/community/')){if(request.method!=='GET'&&env.MODE!=='local'&&env.OPERATIONS_WRITES_ENABLED!=='true')throw new ApiError(503,'OPERATIONS_MAINTENANCE');return response(await communityOwnerAction(env.CORE,owner,path,request));}
   if(path==='/v1/me/manual-projects'&&request.method==='POST')return response(await createManualProject(env.CORE,owner,await boundedBody(request,16384)),201);
   if(path==='/v1/me/profile'){
    if(request.method==='GET'){const row=await env.CORE.prepare('SELECT id,'+profileFields.join(',')+',sync_revision FROM main__profiles WHERE id=?').bind(owner).first();return response(row);}
    if(request.method==='PUT'){
     const body=await boundedBody(request);only(body,['expectedRevision','patch']);const changes=normalizedPatch(body.patch,profileFields);const expected=revision(body.expectedRevision),now=new Date().toISOString();
     const changed=await env.CORE.prepare('UPDATE main__profiles SET '+changes.map(([k])=>k+'=?').join(',')+',sync_revision=sync_revision+1,updated_at=? WHERE id=? AND sync_revision=? RETURNING sync_revision').bind(...changes.map(([,v])=>v),now,owner,expected).first();if(!changed)throw new ApiError(409,'REVISION_CONFLICT');return response(changed);
    }
   }
   if(path==='/v1/me/applications'&&request.method==='GET'){
    const cursor=url.searchParams.get('after')||'';if(cursor)inputId(cursor);const rows=await env.CORE.prepare('SELECT id,project_id,'+applicationFields.join(',')+',sync_revision FROM main__applications WHERE user_id=? AND id>? ORDER BY id LIMIT 101').bind(owner,cursor).all<Record<string,unknown>>();const more=rows.results.length>100;const items=rows.results.slice(0,100);return response({items:items.map(parseRow),nextCursor:more?items.at(-1)?.id:null});
   }
   if(path==='/v1/me/applications'&&request.method==='POST'){
    const body=await boundedBody(request);only(body,['projectId']);const project=inputId(body.projectId);
    const visible=await env.CORE.prepare(`SELECT id FROM main__notices n WHERE n.id=? AND ((${publicVisibility}) OR (n.is_private=1 AND n.created_by=? AND n.admin_deleted_at IS NULL))`).bind(project,owner).first();if(!visible)throw new ApiError(404,'NOTICE_UNAVAILABLE');
    const current=await env.CORE.prepare('SELECT id,sync_revision FROM main__applications WHERE user_id=? AND project_id=?').bind(owner,project).first();if(current)return response(current);
    const created=await env.CORE.prepare('INSERT INTO main__applications(id,user_id,project_id) VALUES(?,?,?) ON CONFLICT(user_id,project_id) DO UPDATE SET project_id=excluded.project_id RETURNING id,sync_revision').bind(crypto.randomUUID(),owner,project).first();return response(created,201);
   }
   if(path.startsWith('/v1/me/applications/')){
    const id=inputId(decodeURIComponent(path.slice('/v1/me/applications/'.length)));
    if(request.method==='GET'){
     if(url.search)throw new ApiError(400,'UNSUPPORTED_QUERY');
     const row=await env.CORE.prepare('SELECT id,project_id,'+applicationFields.join(',')+',sync_revision FROM main__applications WHERE user_id=? AND id=?').bind(owner,id).first<Record<string,unknown>>();
     if(!row)throw new ApiError(404,'APPLICATION_NOT_FOUND');return response(parseRow(row));
    }
    const body=await boundedBody(request);only(body,request.method==='DELETE'?['expectedRevision']:['expectedRevision','patch']);const expected=revision(body.expectedRevision);
    if(request.method==='PUT'){
     const changes=normalizedPatch(body.patch,applicationFields);const row=await env.CORE.prepare('UPDATE main__applications SET '+changes.map(([k])=>k+'=?').join(',')+',sync_revision=sync_revision+1,updated_at=? WHERE user_id=? AND id=? AND sync_revision=? RETURNING id,sync_revision').bind(...changes.map(([,v])=>v),new Date().toISOString(),owner,id,expected).first();if(!row)throw new ApiError(409,'REVISION_CONFLICT');return response(row);
    }
    if(request.method==='DELETE'){const row=await env.CORE.prepare('DELETE FROM main__applications WHERE user_id=? AND id=? AND sync_revision=? RETURNING id').bind(owner,id,expected).first();if(!row)throw new ApiError(409,'REVISION_CONFLICT');return response({deleted:true,id});}
   }
   if(path==='/v1/me/workbench'){
    if(request.method==='GET'){const row=await env.CORE.prepare('SELECT completed_todo_ids,custom_todos,mentor_contacts,sync_revision FROM main__workbench_states WHERE user_id=?').bind(owner).first<Record<string,unknown>>();return response(row?parseRow(row):null);}
    if(request.method==='PUT'){
     const body=await boundedBody(request,512000);only(body,['expectedRevision','completed_todo_ids','custom_todos','mentor_contacts']);const expected=body.expectedRevision===0?0:revision(body.expectedRevision);
     for(const k of ['completed_todo_ids','custom_todos','mentor_contacts'])if(!Array.isArray(body[k]))throw new ApiError(400,'ARRAY_REQUIRED');
     await protectWorkbenchUpdate(env.CORE,owner,expected as number,body);
     if(expected===0){const row=await env.CORE.prepare('INSERT INTO main__workbench_states(user_id,completed_todo_ids,custom_todos,mentor_contacts) VALUES(?,?,?,?) RETURNING sync_revision').bind(owner,JSON.stringify(body.completed_todo_ids),JSON.stringify(body.custom_todos),JSON.stringify(body.mentor_contacts)).first();return response(row,201);}
     const row=await env.CORE.prepare('UPDATE main__workbench_states SET completed_todo_ids=?,custom_todos=?,mentor_contacts=?,sync_revision=sync_revision+1,updated_at=? WHERE user_id=? AND sync_revision=? RETURNING sync_revision').bind(JSON.stringify(body.completed_todo_ids),JSON.stringify(body.custom_todos),JSON.stringify(body.mentor_contacts),new Date().toISOString(),owner,expected).first();if(!row)throw new ApiError(409,'REVISION_CONFLICT');return response(row);
    }
   }
   if(path==='/v1/me/vault'){
    if(request.method==='DELETE'){
     const body=await boundedBody(request,256);only(body,['expectedRevision']);if(typeof body.expectedRevision!=='string'||!/^[0-9a-f-]{36}$/i.test(body.expectedRevision))throw new ApiError(400,'INVALID_VAULT_REVISION');
     const removed=await env.CORE.prepare('DELETE FROM main__user_vaults WHERE user_id=? AND revision=? RETURNING revision').bind(owner,body.expectedRevision).first();if(!removed)throw new ApiError(409,'VAULT_REVISION_CONFLICT');return response({deleted:true});
    }
    if(request.method==='GET'){const row=await env.CORE.prepare('SELECT encrypted_payload,revision,schema_version,updated_at FROM main__user_vaults WHERE user_id=?').bind(owner).first<Record<string,unknown>>();return response(row?parseRow(row):null);}
    if(request.method==='PUT'){
     const body=await boundedBody(request,2050000);only(body,['expectedRevision','revision','encryptedPayload','schemaVersion']);
     const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
     if(!uuid(body.revision)||(body.expectedRevision!==null&&!uuid(body.expectedRevision))||body.revision===body.expectedRevision)throw new ApiError(400,'INVALID_VAULT_REVISION');
     if(!Number.isInteger(body.schemaVersion)||Number(body.schemaVersion)<1||Number(body.schemaVersion)>32767)throw new ApiError(400,'INVALID_SCHEMA_VERSION');
     const payload=body.encryptedPayload;if(!payload||Array.isArray(payload)||typeof payload!=='object'||(payload as Record<string,unknown>).algorithm!=='AES-GCM-256')throw new ApiError(400,'INVALID_ENCRYPTED_PAYLOAD');
     const json=JSON.stringify(payload);if(new TextEncoder().encode(json).byteLength>2040000)throw new ApiError(413,'VAULT_TOO_LARGE');
     const now=new Date().toISOString();
     const row=body.expectedRevision===null?
      await env.CORE.prepare('INSERT INTO main__user_vaults(user_id,encrypted_payload,revision,schema_version,updated_at) VALUES(?,?,?,?,?) RETURNING revision').bind(owner,json,body.revision,body.schemaVersion,now).first():
      await env.CORE.prepare('UPDATE main__user_vaults SET encrypted_payload=?,revision=?,schema_version=?,updated_at=? WHERE user_id=? AND revision=? RETURNING revision').bind(json,body.revision,body.schemaVersion,now,owner,body.expectedRevision).first();
     if(!row)throw new ApiError(409,'VAULT_REVISION_CONFLICT');return response(row,body.expectedRevision===null?201:200);
    }
   }
   throw new ApiError(501,'ROUTE_NOT_YET_MIGRATED');
  }catch(error){
   if(error instanceof ApiError)return response({error:error.message,requestId},error.status,error.status===503?{'Retry-After':'15'}:{});
   const message=error instanceof Error?error.message:'';
   if(message.includes('ACCOUNT_CLOSED'))return response({error:'ACCOUNT_BLOCKED',requestId},403);
   if(message.includes('FREE_APPLICATION_LIMIT'))return response({error:'FREE_APPLICATION_LIMIT',requestId},403);
   if(/UNIQUE constraint failed: main__(user_vaults|workbench_states)\./.test(message))return response({error:'REVISION_CONFLICT',requestId},409);
   if(/daily.*limit|quota.*exceed|exceed.*quota|D1.*limit/i.test(message))return response({error:'SERVICE_QUOTA_EXCEEDED',requestId},402);
   return response({error:'SERVICE_UNAVAILABLE',requestId},503,{'Retry-After':'15'});
  }
 }};
}
export default createSnapshotWorker();
