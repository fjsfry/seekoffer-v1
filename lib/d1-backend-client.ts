// Opt-in migration contract. Existing clients are not switched until the
// production Clerk application, target account and complete routes are verified.
export type TokenProvider = () => Promise<string | null>;
import {createQuotaCircuit} from './service-quota-circuit';
export type D1Application = {id:string;project_id:string|null;[key:string]:unknown};
type D1ApplicationPage = {items:D1Application[];nextCursor:string|null};
export class D1RequestError extends Error {
  readonly status: number;
  readonly code?:string;
  constructor(status: number,code?:string) {
    const messages:Record<string,string>={LEGACY_RECOVERY_NOT_AUTHORIZED:'当前账号的恢复授权尚未就绪，请联系支持；原记录仍在本机。',LEGACY_TEXT_REQUIRES_REVIEW:'旧记录内容需要进一步核对，未截断或丢弃。',LEGACY_OWNER_MISMATCH:'旧记录与当前登录账号不一致，已停止恢复。',OPERATIONS_MAINTENANCE:'社区和后台暂时维护，草稿已保留，请稍后重试。',FREE_APPLICATION_LIMIT:'当前免费账号最多可跟进5条申请，已有记录会保留。请先移除不再跟进的项目后再添加。',NOTICE_UNAVAILABLE:'这条通知已下架或暂不可用，暂时不能加入申请。',REVISION_CONFLICT:'申请已在其他页面更新，本地修改已保留，请先刷新核对后再保存。',MIGRATION_READ_ONLY:'服务维护中，修改已保存在本机，云端尚未保存。',EMAIL_VERIFICATION_REQUIRED:'请先完成邮箱验证后再同步申请。',IDENTITY_MAPPING_REQUIRED:'账号关联暂未完成，请保留本地数据并联系支持。'};
    Object.assign(messages,{INVALID_IDENTITY:'登录凭据未通过主站验证，请重新登录。',ACCOUNT_BLOCKED:'账号当前不可用，请联系支持核对状态。',AUTH_VERIFICATION_UNAVAILABLE:'认证已完成，但主站暂时无法核验账号资料，请重试账号同步。',ACCOUNT_PROVISIONING_PENDING:'账号初始化配置尚未就绪，请联系支持。',REGISTRATION_MAINTENANCE:'注册暂时维护中，已有账号可登录。',IDENTITY_MAPPING_INCOMPLETE:'账号资料关联不完整，请联系支持；原数据已保留。'});
    Object.assign(messages,{FILL_LIMIT_REACHED:'本月免费填报次数已用完，工作台与原有资料仍可使用。',PAYMENT_CONFIGURATION_PENDING:'新购买暂时维护，已有订单和权益仍保留。'});
    Object.assign(messages,{ACCOUNT_DELETION_MAINTENANCE:'在线注销申请暂未开放，请通过支持渠道申请。',ACCOUNT_DELETION_EXECUTION_DISABLED:'注销处理暂未启用，申请和资料仍保留。',REAUTHENTICATION_REQUIRED:'请重新验证当前账号后继续。',REFUNDS_DISABLED:'退款处理暂未启用，可查询已有记录。',REFUND_OUTCOME_UNCERTAIN:'退款结果待确认，请勿重复新建退款；请查询原退款单。',FINANCIAL_RETENTION_REVIEW_REQUIRED:'该账号涉及财务记录，需要单独审核，未删除。',DELETION_REQUEST_CONFLICT:'已有注销申请，请刷新查看原申请状态。'});
    super(code&&messages[code]|| (status===402?'云端资料服务暂时受限，认证会话和本地资料仍保留；本次云端操作未完成，请稍后重试。':'请求未完成，请保留待同步数据。'));this.status=status;this.code=code;
  }
}
export function createD1BackendClient(baseUrl:string,getToken:TokenProvider,fetcher:typeof fetch=fetch) {
  const base=new URL(baseUrl);
  if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw new Error('SECURE_API_ORIGIN_REQUIRED');
  if(base.username||base.password||base.search||base.hash)throw new Error('INVALID_API_ORIGIN');
  const quota=createQuotaCircuit();
  async function request<T>(path:string,init:RequestInit={},privateRequest=false):Promise<T>{
    if(quota.blocked())throw new D1RequestError(402);
    const headers=new Headers(init.headers);headers.set('Accept','application/json');
    if(privateRequest){const token=await getToken();if(!token)throw new D1RequestError(401);headers.set('Authorization','Bearer '+token);}
    if(init.body)headers.set('Content-Type','application/json');
    const response=await fetcher(new URL(path,base),{...init,headers,signal:init.signal||AbortSignal.timeout(12_000)});
    if(!response.ok){
      const body=await response.json().catch(()=>null) as {error?:unknown}|null;const code=typeof body?.error==='string'&&/^[A-Z_]{1,80}$/.test(body.error)?body.error:undefined;
      if(response.status===402&&code!=='FILL_LIMIT_REACHED')quota.restrict();
      throw new D1RequestError(response.status,code);
    }
    return response.json() as Promise<T>;
  }
  return {
    accountDeletion:(payload:Record<string,unknown>)=>request<Record<string,unknown>>('/v1/me/account-deletion',{method:'POST',body:JSON.stringify(payload)},true),
    accountDeletionQueue:(after='')=>request<{items:{requestId:string;userId:string;state:string;requestedAt:string}[];nextCursor:string|null}>('/v1/admin/account-deletions'+(after?'?after='+encodeURIComponent(after):''),{},true),
    processAccountDeletion:(requestId:string)=>request<Record<string,unknown>>('/v1/admin/account-deletions',{method:'POST',body:JSON.stringify({requestId,confirmation:'process-verified-shared-deletion'})},true),
    refund:(payload:Record<string,unknown>)=>request<Record<string,unknown>>('/v1/admin/refunds',{method:'POST',body:JSON.stringify(payload)},true),
    billing:(payload:Record<string,unknown>)=>request('/v1/me/billing',{method:'POST',body:JSON.stringify(payload)},true),
    billingPlans:()=>request('/v1/billing/plans'),
    recoverLegacy:(records:Record<string,unknown>[],signal?:AbortSignal)=>request<{items:{projectId:string;status:string;applicationId?:string}[];sourceRetained:boolean}>('/v1/me/legacy-applications',{method:'POST',body:JSON.stringify({records}),signal},true),
    admin:(payload:Record<string,unknown>)=>request('/v1/admin',{method:'POST',body:JSON.stringify(payload)},true),
    communityPosts:(query:URLSearchParams,signal?:AbortSignal)=>request<{items:Record<string,unknown>[];metrics:{offers:number;discussions:number;recent:number;schools:number};pagination:{page:number;totalPages:number;total:number}}>('/v1/community/posts?'+query,{signal}),
    communityComments:(postId:string,page:number)=>request<{items:Record<string,unknown>[];nextPage:number|null}>('/v1/community/comments?'+new URLSearchParams({postId,page:String(page)})),
    communityFollows:(page:number)=>request<{ids:string[];nextPage:number|null}>('/v1/me/community/follows?page='+page,{},true),
    communityWrite:(resource:'posts'|'comments'|'follows',payload:Record<string,unknown>)=>request('/v1/me/community/'+resource,{method:'POST',body:JSON.stringify(payload)},true),
    communityReport:(payload:Record<string,unknown>,signedIn:boolean)=>request('/v1/community/report',{method:'POST',body:JSON.stringify(payload)},signedIn),
    profile:(token?:string)=>request('/v1/me/profile',token?{headers:{Authorization:'Bearer '+token}}:{},!token),
    bootstrap:(token:string)=>request('/v1/me/bootstrap',{method:'POST',headers:{Authorization:'Bearer '+token},body:'{}'}),
    updateProfile:(expectedRevision:number,patch:Record<string,unknown>)=>request('/v1/me/profile',{method:'PUT',body:JSON.stringify({expectedRevision,patch})},true),
    workbench:()=>request('/v1/me/workbench',{},true),
    saveWorkbench:(expectedRevision:number,state:{completed_todo_ids:unknown[];custom_todos:unknown[];mentor_contacts:unknown[]})=>request('/v1/me/workbench',{method:'PUT',body:JSON.stringify({...state,expectedRevision})},true),
    createManualProject:(requestId:string,project:Record<string,unknown>)=>request('/v1/me/manual-projects',{method:'POST',body:JSON.stringify({requestId,project})},true),
    notices:(query:URLSearchParams,signal?:AbortSignal)=>request('/v1/notices?'+query,{signal}),
    notice:(id:string)=>request('/v1/notices/'+encodeURIComponent(id)),
    async applications():Promise<D1Application[]> {
      const items:D1Application[]=[],seen=new Set<string>();let cursor:string|null=null;
      do {
        const page:D1ApplicationPage=await request<D1ApplicationPage>('/v1/me/applications'+(cursor?'?after='+encodeURIComponent(cursor):''),{},true);
        if(!page||!Array.isArray(page.items)||!(page.nextCursor===null||typeof page.nextCursor==='string'))throw new D1RequestError(502);
        if(page.nextCursor!==null&&(!page.nextCursor||seen.has(page.nextCursor)))throw new D1RequestError(502);
        items.push(...page.items);cursor=page.nextCursor;if(cursor)seen.add(cursor);
      }while(cursor);
      return items;
    },
    async applicationNotices(ids:readonly string[]) {
      const unique=[...new Set(ids)],items:Record<string,unknown>[]=[],unavailableIds:string[]=[];
      if(unique.some(id=>typeof id!=='string'||!id||id.length>180))throw new D1RequestError(400);
      for(let start=0;start<unique.length;start+=99){
        const page=await request<{items:Record<string,unknown>[];unavailableIds:string[]}>('/v1/me/notices/by-ids',{method:'POST',body:JSON.stringify({ids:unique.slice(start,start+99)})},true);
        if(!page||!Array.isArray(page.items)||!Array.isArray(page.unavailableIds))throw new D1RequestError(502);
        items.push(...page.items);unavailableIds.push(...page.unavailableIds);
      }
      return {items,unavailableIds};
    },
    application:(id:string)=>request<D1Application>('/v1/me/applications/'+encodeURIComponent(id),{},true),
    addApplication:(projectId:string)=>request('/v1/me/applications',{method:'POST',body:JSON.stringify({projectId})},true),
    deleteApplication:(id:string,expectedRevision:number)=>request('/v1/me/applications/'+encodeURIComponent(id),{method:'DELETE',body:JSON.stringify({expectedRevision})},true),
    updateApplication:(id:string,expectedRevision:number,patch:Record<string,unknown>)=>request('/v1/me/applications/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({expectedRevision,patch})},true)
  };
}
