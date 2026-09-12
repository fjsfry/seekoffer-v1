import {ApiError,verifyIdentity} from './auth.ts';
import {createSnapshotWorker,resolveSnapshotOwner,type SnapshotEnv} from './snapshot-worker.ts';

const ORIGIN='https://migration.seekoffer.com.cn';
const ISSUER='https://clerk.seekoffer.com.cn';
const PUBKEY='pk_live_Y2xlcmsuc2Vla29mZmVyLmNvbS5jbiQ';
const PROOF_KEY='controlled_browser_acceptance_v1';
const fallback=createSnapshotWorker();
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
type Verifier=typeof verifyIdentity;
function page(){
 const nonce=crypto.randomUUID().replaceAll('-','');
 const body=String.raw`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>寻鹿 SeekOffer · 迁移验收</title>
 <style nonce="${nonce}">body{font:16px/1.7 system-ui,sans-serif;background:#f5f8f6;color:#193a2c;margin:0;padding:48px 20px}main{max-width:680px;margin:auto;background:white;padding:32px;border-radius:20px;border:1px solid #d9e4dd}h1{font-size:26px}a{color:#14663e}button{padding:12px 20px;background:#14663e;color:white;border:0;border-radius:8px;font-size:16px;cursor:pointer}button:disabled{background:#8c9b91;cursor:default}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f8f6;padding:16px;border-radius:8px}small{color:#56665c}</style>
 <main><small>寻鹿 SeekOffer · 应急迁移验收</small><h1>验证我的账号与云端副本</h1><p>此页面只检查当前登录账号的资料、申请和工作台能否读取。不会修改申请、订单或原站数据。</p>
 <p id="state" role="status">正在连接新认证环境…</p><p><a id="login" href="https://accounts.seekoffer.com.cn/sign-in?redirect_url=https%3A%2F%2Fmigration.seekoffer.com.cn%2Facceptance">登录新认证环境</a></p>
 <button id="verify" disabled>开始只读验收</button><pre id="result" aria-live="polite">尚未执行</pre><p><small>本页的浏览请求仅允许访问新认证环境及当前验收站。无需提供密码、验证码或令牌给工作人员。</small></p></main>
 <script defer crossorigin="anonymous" nonce="${nonce}" data-clerk-publishable-key="${PUBKEY}" src="${ISSUER}/npm/@clerk/clerk-js@6.31.0/dist/clerk.browser.js"></script>
 <script nonce="${nonce}">const initialTimer=setTimeout(()=>{document.getElementById('state').textContent='认证初始化超过15秒，请检查网络后刷新一次；页面不会自动循环请求。';},15000);window.addEventListener('load',async()=>{
 const state=document.getElementById('state'),button=document.getElementById('verify'),result=document.getElementById('result');
 try{if(!window.Clerk)throw Error('AUTH_SCRIPT_UNAVAILABLE');let timer;try{await Promise.race([window.Clerk.load(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('AUTH_INIT_TIMEOUT')),15000);})]);}finally{clearTimeout(timer);}clearTimeout(initialTimer);if(!window.Clerk.session){state.textContent='请先使用已迁移的测试账号登录。';return;}state.textContent='新认证环境已登录，可以开始只读验收。';button.disabled=false;
 button.onclick=async()=>{button.disabled=true;result.textContent='正在核验身份和本人数据…';
 try{const token=await window.Clerk.session.getToken();if(!token)throw Error('LOGIN_REQUIRED');const response=await fetch('/acceptance/api/verify',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(25000)});const data=await response.json();if(!response.ok){result.textContent='验收未通过：'+(data.error||response.status)+'。请保留当前页面并反馈该提示。';return;}result.textContent='只读验收通过\n账号签名与来源：通过\n原用户身份关联：通过\n本人资料：通过\n本人申请：通过\n本人工作台：通过\n业务写入：0\n验收编号：'+data.requestId;state.textContent='当前测试账号的浏览器到新后端读取链路已通过。';}
 catch{result.textContent='请求未完成。没有自动重试，请反馈此提示。';}};
 }catch(error){clearTimeout(initialTimer);state.textContent=error.message==='AUTH_INIT_TIMEOUT'?'认证初始化超过15秒，请反馈此提示；页面不会自动重试。':'新认证环境加载失败，请反馈此提示；不要改用原站继续验收。';}});</script></html>`;
 return new Response(body,{headers:{...noStore,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}' ${ISSUER}; style-src 'nonce-${nonce}'; connect-src 'self' ${ISSUER}; worker-src 'self' blob:; img-src 'self' https://img.clerk.com data:; frame-src ${ISSUER} https://challenges.cloudflare.com; base-uri 'none'; form-action https://accounts.seekoffer.com.cn; frame-ancestors 'none'`}});
}
export function createAcceptanceWorker(verify:Verifier=verifyIdentity){
 return {async fetch(request:Request,env:SnapshotEnv):Promise<Response>{
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/acceptance'))return fallback.fetch(request,env);
  const respond=(value:unknown,status=200)=>Response.json(value,{status,headers:noStore});
  try{
   if(env.MODE!=='preview'||env.BUSINESS_WRITES_ENABLED!=='false'||env.CLERK_ISSUER!==ISSUER||env.AUTHORIZED_PARTIES!==ORIGIN)throw new ApiError(503,'ACCEPTANCE_NOT_CONFIGURED');
   if(url.origin!==ORIGIN)throw new ApiError(404,'ACCEPTANCE_HOST_REQUIRED');
   const origin=request.headers.get('origin');if(origin&&origin!==ORIGIN)throw new ApiError(403,'ORIGIN_NOT_ALLOWED');
   if(request.method!=='GET')throw new ApiError(405,'READ_ONLY');
   if(url.pathname==='/acceptance'||url.pathname==='/acceptance/')return page();
   if(url.pathname!=='/acceptance/api/verify')throw new ApiError(404,'NOT_FOUND');
   if(url.search)throw new ApiError(400,'UNSUPPORTED_QUERY');
   const authorization=request.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))throw new ApiError(401,'AUTH_REQUIRED');
   const identity=await verify(authorization.slice(7),env);
   const owner=await resolveSnapshotOwner(env.CORE,identity);
   // Only reuse a signature-verified identity within this request. The normal API
   // still performs ownership and source account-state checks for every endpoint.
   const api=createSnapshotWorker(async()=>identity);
   const checks=[];let rowsRead=0;
   for(const resource of ['profile','applications','workbench']){
    const target=new URL('/v1/me/'+resource,ORIGIN);const headers=new Headers({Authorization:authorization,'X-Preview-Access':env.PREVIEW_ACCESS_TOKEN||'',Origin:ORIGIN});
    const response=await api.fetch(new Request(target,{headers}),env);if(response.status!==200)throw new ApiError(response.status,'CONTROLLED_'+resource.toUpperCase()+'_FAILED');
    if(Number(response.headers.get('x-d1-rows-written'))!==0)throw new ApiError(503,'UNEXPECTED_BUSINESS_WRITE');
    const data=await response.json() as Record<string,unknown>|null;
    if(resource==='profile'&&data?.id!==owner)throw new ApiError(503,'PROFILE_IDENTITY_MISMATCH');
    if(resource==='applications'&&!Array.isArray(data?.items))throw new ApiError(503,'APPLICATION_SHAPE_MISMATCH');
    if(resource==='workbench'&&data!==null&&!Array.isArray(data.custom_todos))throw new ApiError(503,'WORKBENCH_SHAPE_MISMATCH');
    rowsRead+=Number(response.headers.get('x-d1-rows-read'));checks.push({resource,status:response.status,queries:Number(response.headers.get('x-d1-queries')),rowsRead:Number(response.headers.get('x-d1-rows-read')),rowsWritten:0});
   }
   const proof={at:new Date().toISOString(),requestId:crypto.randomUUID(),layer:'browser-session-to-worker-d1',issuer:ISSUER,authorizedParty:ORIGIN,signatureVerified:true,originalUUIDMappingVerified:true,checks,businessWrites:0,readOnly:true};
   // One fixed diagnostic checkpoint for this acceptance version, never a user row.
   // Read before insert makes retries read-only; a simultaneous first run cannot replace it.
   const prior=await env.CORE.prepare('SELECT value FROM _runtime_state WHERE key=?').bind(PROOF_KEY).first();
   let diagnosticRowsWritten=0;
   if(!prior){const saved=await env.CORE.prepare('INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING').bind(PROOF_KEY,JSON.stringify(proof)).run();diagnosticRowsWritten=Number(saved.meta?.rows_written||0);}
   return respond({...proof,rowsRead,diagnosticRowsWritten});
  }catch(error){if(error instanceof ApiError)return respond({error:error.message},error.status);return respond({error:'ACCEPTANCE_UNAVAILABLE'},503);}
 }};
}
export default createAcceptanceWorker();
