import fs from 'node:fs';import path from 'node:path';import net from 'node:net';import crypto from 'node:crypto';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const root=process.cwd(),exe=path.join(root,'src-tauri/target/release/seekoffer-desktop.exe'),out=path.join(root,'artifacts/d1-migration/desktop-v0.2.25');fs.mkdirSync(out,{recursive:true});
const config=JSON.parse(fs.readFileSync('src-tauri/tauri.d1-acceptance-20260912.conf.json'));
assert.equal(config.identifier,'com.seekoffer.desktop.d1acceptance20260912');
assert.ok(fs.readFileSync(exe).includes(Buffer.from(config.identifier)),'WRONG_ACCEPTANCE_BINARY');
const browserArguments=config.app?.windows?.find(w=>w.label==='main')?.additionalBrowserArgs||'';
const port=Number(browserArguments.match(/--remote-debugging-port=(\d+)/)?.[1]);assert.ok(port>1024&&browserArguments.includes('--remote-debugging-address=127.0.0.1'),'MISSING_ISOLATED_LOOPBACK_CONFIG');
const listener=net.createServer();await new Promise((r,j)=>{listener.once('error',j);listener.listen(port,'127.0.0.1',r);});await new Promise(r=>listener.close(r));
const profile=path.join(root,'artifacts','nv-'+crypto.randomUUID().slice(0,8));fs.mkdirSync(profile,{recursive:true});
const child=spawn(exe,[],{cwd:path.dirname(exe),windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-address=127.0.0.1 --remote-debugging-port=${port}`}});
const report={at:new Date().toISOString(),identifier:config.identifier,exeSHA256:crypto.createHash('sha256').update(fs.readFileSync(exe)).digest('hex'),productionWrites:0,privateDataRead:false,realLoginTested:false,checks:[]};
let browser,stage='startup';
async function until(fn){for(let i=0;i<120;i++){if(fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('FIXTURE_STATE_TIMEOUT');}
try{
 const base='http://127.0.0.1:'+port;let ready=false;
 for(let i=0;i<45;i++){try{const r=await fetch(base+'/json/version',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
 assert.ok(ready,'WEBVIEW_NOT_READY:childExit='+child.exitCode);browser=await chromium.connectOverCDP(base);
 let page;for(let i=0;i<30;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://tauri.localhost')&&!p.url().includes('desktop-splash'));if(page)break;await new Promise(r=>setTimeout(r,500));}assert.ok(page);
 await page.waitForFunction(()=>Boolean(window.__TAURI_INTERNALS__?.invoke),null,{timeout:15000});
 stage='native public transport';const native=await page.evaluate(async()=>{
  const invoke=window.__TAURI_INTERNALS__.invoke;
  const list=await invoke('native_public_request',{path:'/api/public/notices/?page=1&pageSize=16&year=2026&sort=publish',method:'GET',body:null});
  const id=list.items?.[0]?.id;if(!id)throw Error('PUBLIC_LIST_EMPTY');
  const detail=await invoke('native_public_request',{path:'/v1/public/notice-detail?id='+encodeURIComponent(id),method:'GET',body:null});
  let scopeRejected=false;try{await invoke('native_public_request',{path:'https://unrelated.invalid/',method:'GET',body:null});}catch{scopeRejected=true;}
  return{count:list.items.length,bytes:new TextEncoder().encode(JSON.stringify(list)).length,detailIdMatches:detail?.id===id,scopeRejected};
 });assert.equal(native.count,16);assert.ok(native.detailIdMatches&&native.scopeRejected);report.nativePublic=native;
 const context=page.context(),calls=[],errors=[],external=[];report.calls=calls;report.errors=errors;page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
 const owner='00000000-0000-4000-8000-000000000001';
 let state={user_id:owner,completed_todo_ids:[],custom_todos:[{id:'fixture-existing',text:'原生日程样本',category:'学习',priority:'high',completed:false,note:'原生合成备注',updated_at:'2026-09-12T00:00:00Z'}],mentor_contacts:[{id:'fixture-contact',mentorName:'原生联系人样本',contactChannel:'邮件',nextFollowUpDate:'2026-09-20',privacyNotice:'合成私密说明',updated_at:'2026-09-12T00:00:00Z'}],sync_revision:1};let failure=0;
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin==='http://tauri.localhost')return route.continue();
  if(url.origin!=='https://migration.seekoffer.com.cn'){external.push(url.hostname);return route.abort();}
  calls.push({path:url.pathname,method:req.method()});let status=200,data={};
  if(url.pathname==='/v1/me/profile')data={id:owner,nickname:'原生合成验收',age:'',undergraduate_school:'',major:'',grade:'大四',target_major:'',target_region:'',sync_revision:1};
  else if(url.pathname==='/v1/me/workbench'){
   if(failure){status=failure;data={error:failure===402?'SERVICE_QUOTA_EXCEEDED':'SYNTHETIC_OFFLINE'};}
   else if(req.method()==='PUT'){const body=req.postDataJSON();assert.equal(body.expectedRevision,state.sync_revision);const {expectedRevision,...patch}=body;state={...state,...patch,sync_revision:expectedRevision+1};data=state;}else data=state;
  }else if(url.pathname==='/v1/me/applications')data={items:[],nextCursor:null};
  else if(url.pathname==='/v1/me/billing')data={isPro:false,entitlement:{user_id:owner,status:'free'},fillUsage:{limit:3,used:0,remaining:3}};
  else{status=404;data={error:'FIXTURE_NOT_PROVIDED'};}
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 // Auth/session IPC is replaced ONLY inside this empty, separately identified
 // acceptance WebView. No real password, token, DPAPI file or account is used.
 const synthetic=()=>{const install=()=>{
  if(!window.__TAURI_INTERNALS__?.invoke)return false;
  const original=window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
  window.__TAURI_INTERNALS__.invoke=(command,args)=>{
   if(command==='native_auth_session'||command==='native_auth_login')return Promise.resolve({accessToken:'SYNTHETIC_ONLY',expiresAt:Math.floor(Date.now()/1000)+3600,subject:'user_fixture',email:'fixture@example.invalid',sessionId:'sess_fixture'});
   if(command==='native_auth_sign_out')return Promise.resolve();
   if(command==='native_public_request')return Promise.resolve({items:[],pagination:{page:1,pageSize:16,total:0,totalPages:0}});
   return original(command,args);
  };return true;};if(!install()){const timer=setInterval(()=>{if(install())clearInterval(timer);},1);setTimeout(()=>clearInterval(timer),3000);}};
 await context.addInitScript(synthetic);await page.evaluate(synthetic);await page.clock.install();
 await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.includes('00000000-0000-4000-8000-000000000001'))localStorage.removeItem(key);});
 stage='synthetic schedule';await page.goto('http://tauri.localhost/me/?view=schedule',{waitUntil:'domcontentloaded'});
 await page.evaluate(synthetic);
 const login=page.getByRole('button',{name:'在系统浏览器登录',exact:true});
 if(await login.count())await login.click();
 await page.getByRole('heading',{name:'日程与提醒',exact:true}).waitFor({timeout:20000});
 const saved=()=>page.getByText(/本机已保存 · 云端已同步/).first().waitFor({timeout:15000});await saved();
 await page.getByRole('button',{name:'新建日程',exact:true}).first().click();await page.getByPlaceholder('例如：补齐成绩单并核对报名入口').fill('原生新增事项');await page.getByRole('button',{name:'保存日程',exact:true}).click();
 await until(()=>state.custom_todos.some(t=>t.text==='原生新增事项'));await saved();assert.equal(state.mentor_contacts[0].nextFollowUpDate,'2026-09-20');report.checks.push('native WebView schedule create and rich contact preservation (synthetic IPC/API)');
 stage='remote deletion';state={...state,custom_todos:[],sync_revision:state.sync_revision+1};await page.reload({waitUntil:'domcontentloaded'});await saved();assert.equal(await page.getByText('原生新增事项',{exact:true}).count(),0);report.checks.push('remote deletion stays deleted after native page reload');
 stage='quota failure';failure=402;await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'重新同步',exact:true}).waitFor();
 await page.getByRole('button',{name:'新建日程',exact:true}).first().click();await page.getByPlaceholder('例如：补齐成绩单并核对报名入口').fill('额度不足本机草稿');await page.getByRole('button',{name:'保存日程',exact:true}).click();
 await page.waitForFunction(()=>Object.entries(localStorage).some(([k,v])=>k.includes('custom-todos')&&v.includes('额度不足本机草稿')));
 const count=calls.filter(c=>c.path==='/v1/me/workbench').length;await page.evaluate(()=>{for(let i=0;i<12;i++)document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(1000);assert.equal(calls.filter(c=>c.path==='/v1/me/workbench').length,count);assert.ok(!state.custom_todos.some(t=>t.text==='额度不足本机草稿'));
 await page.getByRole('button',{name:'重新同步',exact:true}).click();assert.equal(calls.filter(c=>c.path==='/v1/me/workbench').length,count);
 await page.clock.fastForward('01:01');failure=0;await page.getByRole('button',{name:'重新同步',exact:true}).click();await until(()=>state.custom_todos.some(t=>t.text==='额度不足本机草稿'));await saved();
 report.checks.push('402 preserves native draft; no visibility retry storm; explicit resume saves');
 assert.deepEqual(errors,[]);assert.equal(external.filter(h=>/supabase\.(co|net)$/.test(h)).length,0);report.errors=errors;report.supabaseRequests=0;report.syntheticApiRequests=calls.length;report.state='PASSED';
}catch(e){report.state='FAILED';report.stage=stage;report.error=String(e.message).split('\n').slice(0,5).join('\n');process.exitCode=1;}
finally{if(browser)await browser.close();if(child.exitCode===null)child.kill();fs.writeFileSync(path.join(out,'native-workbench-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
