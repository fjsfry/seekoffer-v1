'use client';
import type {UserSession} from './user-session';
import {createD1BackendClient,D1RequestError} from './d1-backend-client';
import {clerkPortalUrl} from './clerk-portal-url';
import {createQuotaCircuit} from './service-quota-circuit';
export {clerkPortalUrl} from './clerk-portal-url';
export type ClerkBrowser={load():Promise<unknown>;session?:{id:string;getToken(options?:{skipCache?:boolean}):Promise<string|null>}|null;user?:{id:string;primaryEmailAddress?:{emailAddress:string}|null}|null;addListener(callback:()=>void,options?:{skipInitialEmit?:boolean}):()=>void;signOut(options:{sessionId:string}):Promise<void>};
type Profile={id:string;nickname:string;age:string;undergraduate_school:string;major:string;grade:string;target_major:string;target_region:string;sync_revision:number};
export class D1SessionChangedError extends Error{constructor(){super('账号已切换，请重新同步当前账号。');}}
const FAPI='https://clerk.seekoffer.com.cn';
let loading:Promise<ClerkBrowser>|null=null;
async function timeout<T>(promise:Promise<T>,ms=15000){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('新认证服务连接超时，请保留本地数据后重试。')),ms);})]);}finally{clearTimeout(timer);}}
export function loadClerkBrowser():Promise<ClerkBrowser>{
 if(process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE==='desktop')return import('./native-auth-bridge').then(m=>m.loadNativeClerkBrowser());
 if(typeof window==='undefined')return Promise.reject(new Error('认证只能在客户端加载。'));
 if(loading)return loading;
 loading=(async()=>{
  if(window.location.protocol!=='https:'||!(window.location.hostname==='seekoffer.com.cn'||window.location.hostname.endsWith('.seekoffer.com.cn')))throw new Error('当前客户端尚未配置新认证的安全登录入口。');
  const key=process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if(key!=='pk_live_Y2xlcmsuc2Vla29mZmVyLmNvbS5jbiQ')throw new Error('新认证环境配置不匹配，已停止连接。');
  const global=window as typeof window&{Clerk?:ClerkBrowser};
  if(!global.Clerk){
   await timeout(new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');script.src=FAPI+'/npm/@clerk/clerk-js@6.31.0/dist/clerk.browser.js';script.async=true;script.crossOrigin='anonymous';script.dataset.clerkPublishableKey=key;
    script.onload=()=>resolve();script.onerror=()=>{script.remove();reject(new Error('新认证组件加载失败，请稍后重试。'));};document.head.appendChild(script);
   }));
  }
  if(!global.Clerk)throw new Error('新认证组件未就绪。');await timeout(global.Clerk.load());return global.Clerk;
 })().catch(e=>{loading=null;throw e;});return loading;
}
export function redirectToClerkSignIn(){window.location.assign(clerkPortalUrl(window.location.href));}
export function redirectToClerkSignUp(){window.location.assign(clerkPortalUrl(window.location.href,'sign-up'));}
export function createClerkSessionBridge(getClerk:()=>Promise<ClerkBrowser>,fetchProfile:(token:string)=>Promise<unknown>,onValidated?:(identity:{sessionId:string;subject:string;userId:string;profileRevision:number})=>void){
 const inFlight=new Map<string,Promise<UserSession|null>>();
 return {async hydrate():Promise<UserSession|null>{
  const clerk=await getClerk(),session=clerk.session,subject=clerk.user?.id;if(!session||!subject)return null;
  const identity=session.id+':'+subject;if(inFlight.has(identity))return inFlight.get(identity)!;
  const operation=(async()=>{
   const token=await session.getToken({skipCache:true});if(!token)throw new Error('登录状态已失效，请重新登录。');
   const value=await fetchProfile(token);
   if(clerk.session?.id!==session.id||clerk.user?.id!==subject)throw new D1SessionChangedError();
   if(!value||typeof value!=='object'||!/^([0-9a-f]{8}-)([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String((value as Profile).id)))throw new Error('原账号关联暂不可用，已保留本地数据。');
   const p=value as Profile;
   if(!['nickname','age','undergraduate_school','major','grade','target_major','target_region'].every(k=>typeof (value as Record<string,unknown>)[k]==='string')||!Number.isSafeInteger(p.sync_revision)||p.sync_revision<1)throw new Error('个人资料响应不完整，已保留本地数据。');
   onValidated?.({sessionId:session.id,subject,userId:p.id,profileRevision:p.sync_revision});
   return {loggedIn:true,authProvider:'password',userId:p.id,email:clerk.user?.primaryEmailAddress?.emailAddress||'',phone:'',profile:{nickname:p.nickname??'',age:p.age??'',undergraduateSchool:p.undergraduate_school??'',major:p.major??'',grade:p.grade??'大四',targetMajor:p.target_major??'',targetRegion:p.target_region??''}} satisfies UserSession;
  })();inFlight.set(identity,operation);try{return await operation;}finally{inFlight.delete(identity);}
 }};
}
let client:ReturnType<typeof createD1BackendClient>|null=null;
const accountQuota=createQuotaCircuit();
const guardedFetch:typeof fetch=async(input,init)=>{if(accountQuota.blocked())return Response.json({error:'SERVICE_QUOTA_EXCEEDED'},{status:402});const headers=new Headers(init?.headers);if(process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE==='desktop')headers.set('X-Seekoffer-Client','desktop-pkce');const r=await fetch(input,{...init,headers});if(r.status===402){const error=await r.clone().json().catch(()=>null) as {error?:string}|null;if(error?.error!=='FILL_LIMIT_REACHED')accountQuota.restrict();}return r;};
export function prepareExplicitD1SignInRetry(){
 if(!accountQuota.retryExplicitly())throw new D1RequestError(402,'SERVICE_QUOTA_EXCEEDED');
 client=null; // Discard only the request circuit; preserve identity and drafts.
}
function getClient(){
 if(client)return client;const base=process.env.NEXT_PUBLIC_D1_API_URL;if(!base)throw new Error('新数据接口尚未配置。');const url=new URL(base);
 if(url.protocol!=='https:'||!(url.hostname==='seekoffer.com.cn'||url.hostname.endsWith('.seekoffer.com.cn')))throw new Error('新数据接口域名不匹配。');
 client=createD1BackendClient(base,async()=>{const clerk=await loadClerkBrowser();return clerk.session?clerk.session.getToken():null;},guardedFetch);return client;
}
const identities=new Map<string,string>();
const profileRevisions=new Map<string,number>();
export async function readOrInitializeProfile(client:Pick<ReturnType<typeof createD1BackendClient>,'profile'|'bootstrap'>,token:string){
 try{return await client.profile(token);}catch(error){
  if(!(error instanceof D1RequestError)||error.status!==403||!['IDENTITY_MAPPING_REQUIRED','EMAIL_VERIFICATION_REQUIRED'].includes(error.code||''))throw error;
  // One explicit, identity-verified initialization attempt; no retry loop on outage.
  await client.bootstrap(token);return client.profile(token);
 }
}
const bridge=createClerkSessionBridge(loadClerkBrowser,token=>readOrInitializeProfile(getClient(),token),i=>{identities.set(i.sessionId+':'+i.subject,i.userId);profileRevisions.set(i.userId,i.profileRevision);});
export const hydrateClerkD1Session=()=>bridge.hydrate();
export function createPinnedD1Client(getClerk:()=>Promise<ClerkBrowser>,resolveUser:(key:string)=>string|undefined,base:string,fetcher:typeof fetch=fetch){
 return async(userId:string)=>{
  const clerk=await getClerk(),session=clerk.session,subject=clerk.user?.id;
  if(!session||!subject||resolveUser(session.id+':'+subject)!==userId)throw new D1SessionChangedError();
  const token=await session.getToken();if(!token||clerk.session?.id!==session.id||clerk.user?.id!==subject)throw new D1SessionChangedError();
  const pinnedFetch:typeof fetch=async(input,init)=>{
   if(clerk.session?.id!==session.id||clerk.user?.id!==subject)throw new D1SessionChangedError();
   const result=await fetcher(input,init);
   if(clerk.session?.id!==session.id||clerk.user?.id!==subject)throw new D1SessionChangedError();
   return result;
  };
  return Object.assign(createD1BackendClient(base,async()=>token,pinnedFetch),{sessionScope:session.id+':'+subject});
 };
}
export async function d1ClientForUser(userId:string){getClient();return createPinnedD1Client(loadClerkBrowser,key=>identities.get(key),process.env.NEXT_PUBLIC_D1_API_URL!,guardedFetch)(userId);}
export async function updateD1Profile(userId:string,patch:Record<string,unknown>){
 const revision=profileRevisions.get(userId);if(revision===undefined)throw new Error('个人资料尚未完成初次同步，请保留修改。');
 const client=await d1ClientForUser(userId),result=await client.updateProfile(revision,patch) as {sync_revision:number};
 if(!result||!Number.isSafeInteger(result.sync_revision)||result.sync_revision<=revision)throw new Error('个人资料保存结果未确认，请保留修改。');profileRevisions.set(userId,result.sync_revision);
}
export function watchClerkIdentity(callback:(signedIn:boolean)=>void){
 let stopped=false,dispose:(()=>void)|undefined;
 void loadClerkBrowser().then(clerk=>{
  if(stopped)return;let identity=(clerk.session?.id||'')+':'+(clerk.user?.id||'');
  dispose=clerk.addListener(()=>{const next=(clerk.session?.id||'')+':'+(clerk.user?.id||'');if(next===identity)return;identity=next;callback(Boolean(clerk.session&&clerk.user));},{skipInitialEmit:true});
 }).catch(()=>{});return()=>{stopped=true;dispose?.();};
}
export async function signOutClerkSession(){const clerk=await loadClerkBrowser();if(clerk.session)await clerk.signOut({sessionId:clerk.session.id});}
