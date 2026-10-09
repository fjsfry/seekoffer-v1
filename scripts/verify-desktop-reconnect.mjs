import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const baseline=process.argv.includes('--baseline'),directory=path.resolve('.next-desktop'),out='artifacts/desktop-recovery-20261009-browser';fs.mkdirSync(out,{recursive:true});
const owner='00000000-0000-4000-8000-000000000001';
const row={id:'synthetic-application',project_id:'synthetic-notice',sync_revision:1,is_favorited:true,my_status:'已收藏',priority_level:'中',materials_progress:0,cv_ready:false,transcript_ready:false,ranking_proof_ready:false,recommendation_ready:false,personal_statement_ready:false,contact_supervisor_done:false,submitted_at:'',interview_time:'',result_status:'未出结果',my_notes:'合成待办备注保留',custom_reminder_enabled:true};
const notice={id:'synthetic-notice',schoolName:'合成验收大学',departmentName:'合成学院',projectName:'合成通知标题',projectType:'正式推免',discipline:'计算机',publishDate:'2026-09-12',deadlineDate:'2026-12-31',eventStartDate:'',eventEndDate:'',applyLink:'https://example.invalid',sourceLink:'https://example.invalid',requirements:'',materialsRequired:[],examInterviewInfo:'',contactInfo:'',remarks:'',tags:[],status:'报名中',year:2026,deadlineLevel:'future',sourceSite:'fixture',collectedAt:'',updatedAt:'',lastCheckedAt:'',isVerified:true,changeLog:[],historyRecords:[]};
const servedAt=new Date().toISOString(),parts={summary:{stats:{total2026:1,todayUpdates:1,deadlineWithin3Days:0},sideData:{urgentProjects:[],latestProjects:[],todaySchoolUpdates:{date:'2026-09-12',hasTodayRows:false,rows:[]},latestPublishDate:'2026-09-12'}},facets:{facets:{regions:['北京'],schools:['合成验收大学'],categories:['工学'],disciplines:['计算机']}},colleges:{collegeStats:[],topColleges:[]}};
const list={items:[notice],pagination:{page:1,pageSize:16,total:1,totalPages:1},source:'cloudflare',servedAt,metadataStale:false,stats:parts.summary.stats,sideData:{...parts.summary.sideData,topColleges:[]},facets:{...parts.facets.facets,collegeStats:[{schoolName:'清华大学',total:80,active:5,nearDeadline:2,latestPublishDate:'2026-10-09'}]}};
const report={at:new Date().toISOString(),baseline,productionBusinessWrites:0,realCredentialsUsed:false,calls:[],errors:[],checks:[]};
const server=http.createServer((req,res)=>{let f=path.resolve(directory,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(directory+path.sep)&&f!==directory){res.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.txt':'text/x-component'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;let browser,page,healthy=false,withdrawn=false,stage='startup';
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();
 await context.addInitScript(({owner,row,list})=>{
  let callback=0;const session={accessToken:'SYNTHETIC_NATIVE_TOKEN',subject:'user_native_synthetic',email:'native@example.invalid',sessionId:'synthetic-session-001',expiresAt:Date.now()/1000+3600};
  if(!localStorage.getItem('synthetic-seeded')){localStorage.setItem('synthetic-seeded','yes');localStorage.setItem('seekoffer-d1-user-session',JSON.stringify({loggedIn:true,authProvider:'password',userId:owner,email:'native@example.invalid',profile:{}}));localStorage.setItem('seekoffer-d1-applications-v1:'+owner,JSON.stringify({version:1,rows:[row],drafts:{},deletes:{},adds:[],manuals:{}}));}
  window.__nativeCalls=[];window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>++callback,unregisterCallback:()=>{},invoke:async(cmd,args)=>{
   if(cmd==='native_auth_session')return session;if(cmd==='native_auth_login'||cmd==='native_auth_sign_out')throw Error('NO_REAL_LOGIN_OR_SIGNOUT');
   if(cmd==='plugin:window|inner_size')return{width:1440,height:1000};if(cmd==='plugin:window|scale_factor')return 1;
   if(cmd==='native_public_request'){
    window.__nativeCalls.push(args.path);const u=new URL(args.path,'https://example.invalid');
    if(u.pathname==='/v1/notices'){
     if(window.__publicOffline)throw Error('PUBLIC_NETWORK_UNAVAILABLE');
     const empty=u.searchParams.get('q')==='不存在的通知';
     return{...list,items:empty?[]:list.items,pagination:{...list.pagination,total:empty?0:1,pageSize:Number(u.searchParams.get('pageSize')||16)}};
    }
    if(u.pathname==='/v1/notices/detail')return list.items.find(item=>item.id===u.searchParams.get('id'))||null;
    throw Error('UNEXPECTED_PUBLIC_ROUTE');
   }return 1;
  }};window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};
 },{owner,row,list,parts,servedAt});
 await context.route('**/*',r=>{const req=r.request(),u=new URL(req.url());if(u.origin===base)return r.continue();if(u.origin!=='https://migration.seekoffer.com.cn')return r.abort();report.calls.push({path:u.pathname,method:req.method()});assert.equal(req.headers()['x-seekoffer-client'],'desktop-pkce');assert.equal(req.headers().authorization,'Bearer SYNTHETIC_NATIVE_TOKEN');let status=200,data;
  if(u.pathname==='/v1/me/profile'){status=healthy?200:503;data=healthy?{id:owner,nickname:'合成桌面测试',age:'',undergraduate_school:'',major:'',grade:'',target_major:'',target_region:'',sync_revision:1}:{error:'AUTH_VERIFICATION_UNAVAILABLE'};}
  else if(u.pathname==='/v1/me/applications')data={items:[row],nextCursor:null};
  else if(u.pathname==='/v1/me/notices/by-ids'){assert.deepEqual(req.postDataJSON(),{ids:['synthetic-notice']});data=withdrawn?{items:[],unavailableIds:['synthetic-notice']}:{items:[notice],unavailableIds:[]};}
  else if(u.pathname==='/v1/me/workbench')data=null;
  else if(u.pathname==='/v1/me/billing')data={isPro:false,entitlement:null,fillUsage:{limit:3,used:0,remaining:3}};
  else return r.fulfill({status:404,json:{error:'SYNTHETIC_ROUTE_NOT_PROVIDED'}});
  return r.fulfill({status,json:data});
 });page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:/全部申请/}).waitFor({timeout:20000});
 const retry=page.getByRole('button',{name:/重试同步|重新同步/}).first();await retry.waitFor({timeout:16000});
 const before=report.calls.filter(c=>c.path==='/v1/me/profile').length;healthy=true;await retry.click();
 if(baseline){await page.waitForTimeout(2000);assert.equal(report.calls.filter(c=>c.path==='/v1/me/profile').length,before);assert.equal(await page.getByText('合成验收大学',{exact:true}).count(),0);report.checks.push('startup failure cannot recover through original Sync button');await page.screenshot({path:out+'/baseline-stuck.png'});await page.reload({waitUntil:'domcontentloaded'});}
 else{await page.getByText('合成验收大学',{exact:true}).first().waitFor({timeout:15000});assert.ok(report.calls.filter(c=>c.path==='/v1/me/profile').length>before);report.checks.push('explicit Sync revalidates original identity and restores linked notices');const stored=await page.evaluate(owner=>JSON.parse(localStorage.getItem('seekoffer-d1-applications-v1:'+owner)),owner);assert.equal(stored.rows[0].my_notes,row.my_notes);report.checks.push('original application and note preserved');}
 stage='public metadata';await page.goto(base+'/notices/',{waitUntil:'domcontentloaded'});
 if(baseline){await page.waitForTimeout(3000);assert.equal(await page.getByText(/^共 1 条结果$/).count(),0);const calls=await page.evaluate(()=>window.__nativeCalls);assert.ok(calls.some(p=>p.startsWith('/api/public/notices/?')));assert.ok(!calls.some(p=>p.startsWith('/api/public/notices/metadata')));report.checks.push('legacy native list rejects current split metadata response');}
 else{
  await page.getByText(/^共 1 条结果$/).waitFor({timeout:15000});
  const calls=await page.evaluate(()=>window.__nativeCalls);
  assert.ok(calls.some(p=>p.startsWith('/v1/notices?')));
  assert.ok(!calls.some(p=>p.includes('/metadata')));
  report.checks.push('compiled native list renders complete versioned API metadata without removed shards');
  const search=page.getByRole('textbox',{name:'搜索通知',exact:true});
  await page.evaluate(()=>{window.__publicOffline=true;});
  await search.fill('离线未缓存查询');
  await page.getByText('通知加载失败',{exact:true}).waitFor({timeout:15000});
  assert.equal(await page.getByText('没有找到匹配通知',{exact:true}).count(),0);
  assert.equal(await page.getByText('暂无更新记录。',{exact:true}).count(),0);
  report.checks.push('uncached connection failure has retry and unknown statistics, never empty results');
  await page.evaluate(()=>{window.__publicOffline=false;});
  await page.getByRole('button',{name:'重新加载',exact:true}).click();
  await page.getByText(/^共 1 条结果$/).waitFor({timeout:15000});
  await search.fill('不存在的通知');
  await page.getByText('没有找到匹配通知',{exact:true}).waitFor({timeout:15000});
  assert.equal(await page.getByText('通知加载失败',{exact:true}).count(),0);
  report.checks.push('successful zero result is distinct from failure and explicit retry recovers');
  await search.fill('');
  await page.getByText(/^共 1 条结果$/).waitFor({timeout:15000});
 }
 await page.screenshot({path:out+'/'+(baseline?'baseline':'candidate')+'-notices.png'});
 if(!baseline){stage='withdrawn notice';withdrawn=true;await page.goto(base+'/',{waitUntil:'domcontentloaded'});await page.getByText('原通知暂不可用',{exact:true}).first().waitFor({timeout:15000});const labels=await page.evaluate(owner=>JSON.parse(localStorage.getItem('seekoffer-d1-application-labels-v1:'+owner)||'null'),owner);assert.ok(!labels?.labels?.['synthetic-notice']);report.checks.push('explicit withdrawal removes cached title; application remains');}
 assert.deepEqual(report.errors,[]);report.state=baseline?'DESKTOP_RECURRENCE_REPRODUCED':'DESKTOP_RECURRENCE_BROWSER_PASSED';
}catch(e){report.state='FAILED';report.stage=stage;report.error=e.message.split('\n').slice(0,4).join('\n');if(page)await page.screenshot({path:out+'/diagnostic.png'}).catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(out+'/'+(baseline?'baseline':'candidate')+'-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
