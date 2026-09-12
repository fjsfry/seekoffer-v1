// Synthetic accounts only. Every non-local request is fulfilled or blocked.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const directory=path.resolve('.next-desktop'),out=path.resolve('artifacts/d1-migration');
const owner='00000000-0000-4000-8000-000000000001';
const fixtureRow=(id)=>({id,project_id:'notice-'+id,sync_revision:1,is_favorited:true,my_status:'已收藏',priority_level:'中',materials_progress:0,cv_ready:false,transcript_ready:false,ranking_proof_ready:false,recommendation_ready:false,personal_statement_ready:false,contact_supervisor_done:false,submitted_at:'',interview_time:'',result_status:'未出结果',my_notes:'合成原备注 '+id,custom_reminder_enabled:true});
const server=http.createServer((req,res)=>{
  let f=path.resolve(directory,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!f.startsWith(directory+path.sep)&&f!==directory){res.writeHead(403).end();return;}
  if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
  if(!fs.existsSync(f)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.txt':'text/x-component'})[path.extname(f)]||'application/octet-stream');
  fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
const reports=[];let lastPage,lastRequests,lastErrors;
try {
 for(const scenario of ['normal','offline','conflict','quota','response-lost']){
  const rows=[fixtureRow('a'),fixtureRow('b')],context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[],requests=[];let mode='normal',unexpected=0;
  lastPage=page;lastRequests=requests;lastErrors=errors;
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{
    let callback=0;
    const session={accessToken:'SYNTHETIC_NATIVE_TOKEN',subject:'user_native_synthetic',email:'native@example.invalid',sessionId:'synthetic-session-001',expiresAt:Date.now()/1000+3600};
    window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>++callback,unregisterCallback:()=>{},invoke:async cmd=>{
      if(cmd==='native_auth_session'||cmd==='native_auth_login')return session;
      if(cmd==='plugin:window|inner_size')return{width:1440,height:1000};
      if(cmd==='plugin:window|scale_factor')return 1;
      if(cmd==='native_public_request')throw Error('PUBLIC_FIXTURE_NOT_REQUIRED');
      return 1;
    }};
    window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};
  });
  await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());if(u.origin===base)return route.continue();
    requests.push({path:u.pathname,method:req.method()});
    const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(u.origin!=='https://migration.seekoffer.com.cn'){unexpected++;return route.abort();}
    assert.equal(req.headers().authorization,'Bearer SYNTHETIC_NATIVE_TOKEN');
    assert.equal(req.headers()['x-seekoffer-client'],'desktop-pkce');
    if(u.pathname==='/v1/me/profile')return reply({id:owner,nickname:'合成测试',age:'',undergraduate_school:'',major:'',grade:'',target_major:'',target_region:'',sync_revision:1});
    if(u.pathname==='/v1/me/applications')return reply({items:rows,nextCursor:null});
    if(u.pathname==='/v1/me/notices/by-ids'){
      const ids=req.postDataJSON().ids;assert.ok(ids.every(id=>rows.some(r=>r.project_id===id)));
      return reply({items:rows.filter(r=>ids.includes(r.project_id)).map(r=>({id:r.project_id,schoolName:'合成大学'+r.id,departmentName:'测试学院',projectName:'合成申请'+r.id,projectType:'夏令营',discipline:'计算机',deadlineDate:'2030-12-31',publishDate:'2026-09-01',status:'报名中',year:2026,deadlineLevel:'future',materialsRequired:[],tags:[],changeLog:[],historyRecords:[],applyLink:'',sourceLink:'',updatedAt:'2026-09-01',collectedAt:'2026-09-01'})),unavailableIds:[]});
    }
    if(u.pathname==='/v1/me/workbench')return reply({user_id:owner,custom_todos:[],completed_todo_ids:[],mentor_contacts:[],sync_revision:1});
    if(u.pathname==='/v1/me/billing')return reply({entitlement:null,fillUsage:{limit:3,used:0,remaining:3}});
    const row=rows.find(r=>u.pathname==='/v1/me/applications/'+r.id);
    if(row&&req.method()==='GET')return reply(row);
    if(row&&req.method()==='PUT'){
      const payload=req.postDataJSON();assert.deepEqual(Object.keys(payload.patch),['my_notes']);
      if(mode==='offline')return route.abort('internetdisconnected');
      if(mode==='quota')return reply({error:'SERVICE_QUOTA_EXCEEDED'},402);
      if(payload.expectedRevision!==row.sync_revision)return reply({error:'REVISION_CONFLICT'},409);
      Object.assign(row,payload.patch,{sync_revision:row.sync_revision+1});
      if(mode==='response-lost')return route.abort('internetdisconnected');
      return reply({id:row.id,sync_revision:row.sync_revision});
    }
    unexpected++;return reply({error:'UNEXPECTED_SYNTHETIC_ROUTE'},404);
  });
  const open=async(id)=>{
    await page.locator('#desktop-project-row-'+id).waitFor({timeout:20000});
    await page.locator('#desktop-project-row-'+id).click();
    await page.getByRole('tab',{name:'备注',exact:true}).click();
    await page.getByRole('textbox',{name:'申请备注内容',exact:true}).waitFor();
  };
  const notes=page.getByRole('textbox',{name:'申请备注内容',exact:true});
  const save=page.getByRole('button',{name:'保存备注',exact:true});
  const journal=()=>page.evaluate(owner=>JSON.parse(localStorage.getItem('seekoffer-d1-applications-v1:'+owner)),owner);
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});await open('a');
  assert.equal(await notes.inputValue(),rows[0].my_notes);
  const text='合成备注 '+scenario;
  await notes.fill(text);
  if(scenario==='normal'){
    await page.getByRole('tab',{name:'材料',exact:true}).click();
    await page.getByRole('tab',{name:'备注',exact:true}).click();
    assert.equal(await notes.inputValue(),text);
    await page.getByRole('button',{name:'关闭项目详情',exact:true}).click();await open('b');
    assert.equal(await notes.inputValue(),rows[1].my_notes);
    await page.getByRole('button',{name:'关闭项目详情',exact:true}).click();await open('a');
    assert.equal(await notes.inputValue(),text);
  }
  if(scenario==='conflict'){rows[0].my_notes='合成另一设备备注';rows[0].sync_revision++;}
  mode=['offline','quota','response-lost'].includes(scenario)?scenario:'normal';
  await save.click();
  await page.waitForFunction(()=>!document.querySelector('#desktop-project-row-a')?.getAttribute('aria-busy')||document.querySelector('#desktop-project-row-a')?.getAttribute('aria-busy')==='false');
  await page.waitForTimeout(250);
  assert.equal(await notes.inputValue(),text);
  let state=await journal();
  if(scenario==='normal'){
    assert.equal(rows[0].my_notes,text);assert.equal(state.drafts.a,undefined);
  }else{
    assert.equal(state.drafts.a.patch.my_notes,text);
    assert.ok(await page.locator('.desktop-project-notes-actions').innerText().then(t=>t.includes('待同步')));
    if(scenario==='conflict')assert.equal(rows[0].my_notes,'合成另一设备备注');
  }
  await page.reload({waitUntil:'domcontentloaded'});await open('a');
  assert.equal(await notes.inputValue(),text);
  const before=requests.filter(r=>r.method==='PUT').length;
  for(let i=0;i<4;i++)await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});
  await page.waitForTimeout(300);
  assert.equal(requests.filter(r=>r.method==='PUT').length,before);
  if(scenario==='offline'){
    mode='normal';assert.equal(await save.isEnabled(),true);await save.click();
    await page.waitForFunction(owner=>!JSON.parse(localStorage.getItem('seekoffer-d1-applications-v1:'+owner)).drafts.a,owner);
    assert.equal(rows[0].my_notes,text);
  }
  if(scenario==='quota'){
    // Reload deliberately ends the page-wide pause. A fresh quota error starts it again.
    await save.click();await page.waitForTimeout(250);const after=requests.filter(r=>r.method==='PUT').length;
    await save.click();await page.waitForTimeout(250);assert.equal(requests.filter(r=>r.method==='PUT').length,after);
    assert.ok((await journal()).drafts.a);
  }
  if(scenario==='response-lost'){
    mode='normal';
    await page.getByRole('button',{name:'关闭项目详情',exact:true}).click();
    await page.getByRole('button',{name:'设置',exact:true}).click();
    await page.locator('#desktop-settings-tab-account').click();
    await page.getByRole('button',{name:'立即同步',exact:true}).click();
    await page.waitForFunction(owner=>!JSON.parse(localStorage.getItem('seekoffer-d1-applications-v1:'+owner)).drafts.a,owner);
    await page.locator('.desktop-settings-live-region').filter({hasText:'同步完成，申请工作区已更新。'}).waitFor();
    assert.equal(rows[0].my_notes,text);
    assert.equal(rows[0].sync_revision,2);
    assert.equal(requests.filter(r=>r.method==='PUT').length,1);
    assert.ok(requests.some(r=>r.method==='GET'&&r.path==='/v1/me/applications/a'));
  }
  assert.deepEqual(errors,[]);assert.equal(unexpected,0);
  reports.push({scenario,passed:true,writeRequests:requests.filter(r=>r.method==='PUT').length,remoteWrites:0,privateAccountsUsed:false});
  await context.close();
 }
 const result={at:new Date().toISOString(),layer:'compiled-desktop-renderer-synthetic-IPC-HTTP',productionWrites:0,externalRequests:0,reports};
 fs.writeFileSync(path.join(out,'desktop-notes-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){console.error(JSON.stringify({passed:false,error:String(error.message).slice(0,450),completed:reports,requests:lastRequests,errors:lastErrors,syntheticPage:lastPage?await lastPage.locator('body').innerText().then(t=>t.slice(0,1400)).catch(()=>''):''}));process.exitCode=1;}
finally{await browser.close();await new Promise(r=>server.close(r));}
