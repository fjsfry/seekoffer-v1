import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {chromium} from 'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const base='http://127.0.0.1:3419',host='https://www.seekoffer.com.cn',apiHost='https://migration.seekoffer.com.cn';
const owner='00000000-0000-4000-8000-000000000001';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3419'],{cwd:path.resolve('artifacts/website-locked-verification-20260911'),windowsHide:true,env:{...process.env,NODE_OPTIONS:'--require "'+path.resolve('artifacts/website-locked-verification-20260911/scripts/emergency-network-guard.cjs').replaceAll('\\','/')+'"'},stdio:['ignore','pipe','pipe']});
let logs='',browser,stage='start';child.stdout.on('data',b=>logs=(logs+b).slice(-2000));child.stderr.on('data',b=>logs=(logs+b).slice(-2000));
const report={at:new Date().toISOString(),state:'RUNNING',layer:'locked Next.js + isolated Chromium + synthetic API',productionWrites:0,realAccountsUsed:false,checks:[]};
async function until(check){const deadline=Date.now()+12000;while(!check()){if(Date.now()>deadline)throw Error('SYNTHETIC_STATE_WAIT_TIMEOUT');await new Promise(resolve=>setTimeout(resolve,100));}}
try {
 for(let i=0;i<150&&!logs.includes('Ready in');i++){if(child.exitCode!==null)throw Error('LOCAL_SERVER_EXITED');await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(logs.includes('Ready in'));
 stage='public pages';
 for(const route of ['/','/notices/','/offers/','/publish/','/guide/','/faq/','/resources/','/knowledge/','/about/','/privacy/','/terms/','/data-quality/','/download/','/me/account/']){
  const response=await fetch(base+route);assert.equal(response.status,200,route);const html=await response.text();assert.ok(!html.includes('登录、注册、申请工作台、社区和后台已恢复'),route);assert.ok(!html.includes('原有记录与本机草稿保留。'),route);
 }report.checks.push('14 public route responses and no global recovery banner');
 browser=await chromium.launch({headless:true});const context=await browser.newContext();
 await context.addInitScript(()=>{
  window.Clerk={load:async()=>{},session:{id:'sess_fixture',getToken:async()=>'SYNTHETIC_ONLY'},user:{id:'user_fixture',primaryEmailAddress:{emailAddress:'fixture@example.invalid'}},addListener:()=>()=>{},signOut:async()=>{},setActive:async()=>{}};
 });
 let profile={id:owner,nickname:'合成验收',age:'',undergraduate_school:'',major:'',grade:'大四',target_major:'',target_region:'',sync_revision:1};
 let workbench={user_id:owner,completed_todo_ids:[],custom_todos:[],mentor_contacts:[],sync_revision:1};
 let profileFail=false,workbenchFail=false,workbenchFailureStatus=503;const calls=[],errors=[],external=[];
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===host){const headers={...req.headers(),host:'127.0.0.1:3419'};delete headers.cookie;delete headers.authorization;return route.fulfill({response:await route.fetch({url:base+url.pathname+url.search,headers,maxRedirects:0})});}
  if(url.origin!==apiHost){external.push(url.hostname);return route.abort();}
  calls.push({path:url.pathname,method:req.method()});let data={},status=200;const body=req.method()==='GET'?null:req.postDataJSON();
  if(url.pathname==='/v1/me/profile'){
   if(req.method()==='PUT'){
    if(profileFail){status=503;data={error:'SYNTHETIC_SAVE_UNAVAILABLE'};}
    else {assert.equal(body.expectedRevision,profile.sync_revision);profile={...profile,...body.patch,sync_revision:profile.sync_revision+1};data=profile;}
   }else data=profile;
  }else if(url.pathname==='/v1/me/workbench'){
   if(workbenchFail){status=workbenchFailureStatus;data={error:status===402?'SERVICE_QUOTA_EXCEEDED':'SYNTHETIC_SYNC_UNAVAILABLE'};}
   else if(req.method()==='PUT'){assert.equal(body.expectedRevision,workbench.sync_revision);const {expectedRevision,...state}=body;workbench={...workbench,...state,sync_revision:expectedRevision+1};data=workbench;}
   else data=workbench;
  }else if(url.pathname==='/v1/me/applications')data={items:[],nextCursor:null};
  else if(url.pathname==='/v1/me/billing')data={isPro:false,entitlement:{user_id:owner,status:'free'},fillUsage:{limit:3,used:0,remaining:3}};
  else if(url.pathname==='/v1/analytics'){status=402;data={error:'ANALYTICS_DAILY_BUDGET'};}
  else{status=404;data={error:'SYNTHETIC_ROUTE_NOT_PROVIDED'};}
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();await page.clock.install();await page.routeWebSocket('**/*',socket=>socket.close());page.on('pageerror',error=>errors.push(error.message));
 const saved=()=>page.getByText('申请、日程和联系人已同步',{exact:true}).waitFor({timeout:12000});
 stage='profile failure';await page.goto(host+'/me/',{waitUntil:'domcontentloaded'});await saved();
 const name=page.getByPlaceholder('例如 张同学');await name.fill('待同步合成资料');profileFail=true;await page.getByRole('button',{name:'保存基本信息',exact:true}).click();
 await page.getByText(/基本信息待同步，草稿已保存在本机/).waitFor();assert.equal(profile.nickname,'合成验收');
 await page.reload({waitUntil:'domcontentloaded'});await page.getByText(/已恢复本机待同步的基本信息/).waitFor();assert.equal(await name.inputValue(),'待同步合成资料');
 profileFail=false;await page.getByRole('button',{name:'保存基本信息',exact:true}).click();await page.getByText('基本信息已保存并同步。',{exact:true}).waitFor();assert.equal(profile.nickname,'待同步合成资料');report.checks.push('profile failure preserves draft across reload; explicit retry saves');
 stage='schedule';await page.goto(host+'/me/?view=schedule',{waitUntil:'domcontentloaded'});await saved();
 await page.getByPlaceholder('输入日程，例如 复旦材料提交 / 联系导师 / 面试复盘').fill('合成日程验收');
 await page.getByPlaceholder('备注，例如 个人陈述、成绩单、推荐信或下一步动作').fill('合成日程备注');await page.getByRole('button',{name:'新增日程',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('seekoffer:workbench-baseline:v1:00000000-0000-4000-8000-000000000001')||'{}').customTodos?.some(item=>item.text==='合成日程验收'));
 assert.equal(workbench.custom_todos.length,1);assert.equal(workbench.custom_todos[0].note,'合成日程备注');
 const done=page.getByRole('button',{name:'完成日程：合成日程验收',exact:true});await done.click();await until(()=>workbench.completed_todo_ids.includes(workbench.custom_todos[0].id));await saved();
 workbench={...workbench,custom_todos:[],completed_todo_ids:[],sync_revision:workbench.sync_revision+1};const before=calls.filter(call=>call.path==='/v1/me/workbench'&&call.method==='PUT').length;
 await page.reload({waitUntil:'domcontentloaded'});await saved();assert.equal(await page.getByRole('button',{name:/日程：合成日程验收/}).count(),0);assert.equal(calls.filter(call=>call.path==='/v1/me/workbench'&&call.method==='PUT').length,before);report.checks.push('schedule add/note/completion; cloud deletion and uncheck stay deleted without rewrite');
 workbench.mentor_contacts=[{id:'fixture-rich-contact',mentorName:'跨端字段样本',contactChannel:'邮件',nextFollowUpDate:'2026-09-15',privacyNotice:'个人记录',photoPageUrl:'https://example.org/',updated_at:'2026-09-12'}];workbench.sync_revision++;
 stage='contacts';await page.goto(host+'/me/?view=contacts',{waitUntil:'domcontentloaded'});await saved();await page.getByRole('button',{name:'添加导师',exact:true}).first().click();
 await page.getByPlaceholder('导师名字',{exact:true}).fill('合成导师');await until(()=>workbench.mentor_contacts[0]?.mentorName==='合成导师');await saved();
 await page.reload({waitUntil:'domcontentloaded'});await saved();await page.getByRole('button',{name:/合成导师.*保存后会以这一行摘要展示/}).click();assert.equal(await page.getByPlaceholder('导师名字',{exact:true}).inputValue(),'合成导师');
 await page.getByRole('button',{name:'删除联系人',exact:true}).click();await until(()=>workbench.mentor_contacts.filter(item=>!item.deletedAt&&item.id!=='fixture-rich-contact').length===0);await saved();const rich=workbench.mentor_contacts.find(item=>item.id==='fixture-rich-contact');assert.equal(rich.nextFollowUpDate,'2026-09-15');assert.equal(rich.contactChannel,'邮件');assert.equal(rich.privacyNotice,'个人记录');report.checks.push('contact add/edit/reload/tombstone-delete preserves other-device fields');
 stage='read failure and local draft';workbenchFail=true;await page.goto(host+'/me/?view=schedule',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'重新核对并同步日程和联系人'}).waitFor();await page.getByPlaceholder('输入日程，例如 复旦材料提交 / 联系导师 / 面试复盘').fill('断网保留事项');await page.getByRole('button',{name:'新增日程',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('seekoffer-workbench-custom-todos:d1:00000000-0000-4000-8000-000000000001')||'[]').some(item=>item.text==='断网保留事项'));
 const failedCount=calls.length;await page.evaluate(()=>{for(let i=0;i<12;i++)document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(800);assert.equal(calls.length,failedCount);
 workbenchFail=false;await page.getByRole('button',{name:'重新核对并同步日程和联系人'}).click();await until(()=>workbench.custom_todos.some(item=>!item.deletedAt&&item.text==='断网保留事项'));await saved();report.checks.push('initial sync failure retains edits, manual resume, no visibility retry storm');
 stage='quota explicit continuation';workbenchFailureStatus=402;workbenchFail=true;await page.goto(host+'/me/?view=schedule',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'重新核对并同步日程和联系人'}).waitFor();
 await page.getByPlaceholder('输入日程，例如 复旦材料提交 / 联系导师 / 面试复盘').fill('额度恢复草稿');await page.getByRole('button',{name:'新增日程',exact:true}).click();
 const pausedCount=calls.length;await page.getByRole('button',{name:'重新核对并同步日程和联系人'}).click();await page.getByText(/请至少一分钟后重试/).waitFor();assert.equal(calls.length,pausedCount);
 await page.clock.fastForward('01:01');workbenchFail=false;await page.getByRole('button',{name:'重新核对并同步日程和联系人'}).click();await until(()=>workbench.custom_todos.some(item=>!item.deletedAt&&item.text==='额度恢复草稿'));await saved();report.checks.push('402 draft preservation and one-minute explicit continuation without sign-out');
 assert.deepEqual(errors,[]);assert.equal(external.filter(host=>/supabase\.(co|net)$/.test(host)).length,0);report.browserErrors=errors;report.supabaseRequests=0;report.syntheticApiRequests=calls.length;
 await context.close();report.state='PASSED';
}catch(error){report.state='FAILED';report.stage=stage;report.error=String(error.message).split('\n').slice(0,6).join('\n');process.exitCode=1;}
finally{if(browser)await browser.close();if(child.pid)spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});fs.writeFileSync('artifacts/workbench-completion-v2-20260912/browser-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
