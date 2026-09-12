import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { emergencyNotices } from '../tests/fixtures/emergency-notices.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || 'C:/Users/Administrator/node_modules/playwright-core');
const root = process.cwd(), out = resolve(root, 'artifacts/emergency');
let requests = [];
let status = 200;
let rows = emergencyNotices().map(r => ({ id:r.id, school_name:r.schoolName, department_name:r.departmentName, project_name:r.projectName, project_type:r.projectType, discipline:r.discipline, publish_date:r.publishDate, deadline_date:r.deadlineDate, source_link:r.sourceLink, tags:r.tags, status:r.status, year:r.year, requirements:'离线固定样本正文', source_site:'离线验收', is_private:false, admin_status:'published', admin_deleted_at:null }));
const origin = createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');requests.push({path:url.pathname,select:url.searchParams.get('select'),ids:url.searchParams.get('id'),offset:url.searchParams.get('offset')});
  if(status!==200){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'fixture-unavailable'}));return;}
  let result=rows;
  const id=url.searchParams.get('id');
  if(id?.startsWith('eq.'))result=result.filter(r=>r.id===id.slice(3));
  if(id?.startsWith('in.')){const ids=id.slice(4,-1).split(',').map(x=>x.replaceAll('"',''));result=result.filter(r=>ids.includes(r.id));}
  const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||1000);
  result=result.slice(offset,offset+limit);
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
});
const staticRoot=resolve(out,'readonly-fixture');
const staticServer=createServer(async(req,res)=>{
  try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';const file=resolve(staticRoot,'.'+path);if(!file.startsWith(staticRoot+'\\'))throw new Error('path');const body=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css'})[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end();}
});
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const originPort=await listen(origin),staticPort=await listen(staticServer);
const env={...process.env,SEEKOFFER_EMERGENCY_BUILD:'true',NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${originPort}`,NEXT_PUBLIC_SUPABASE_ANON_KEY:'offline-public-fixture',NOTICE_REVALIDATE_TOKEN:'offline-revalidation-fixture-token-12345678',NEXT_TELEMETRY_DISABLED:'1'};
delete env.SEEKOFFER_OFFLINE_FIXTURE;
let log='';
const child=spawn(process.execPath,[resolve(root,'node_modules/next/dist/bin/next'),'start','-p','33571','-H','127.0.0.1'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
const base='http://127.0.0.1:33571';
let browser;
const evidence={startedAt:new Date().toISOString(),productionRequests:0};
try{
  for(let i=0;i<60;i++){try{if((await fetch(base+'/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
  const invalidate=()=>fetch(base+'/api/internal/revalidate-notices/',{method:'POST',headers:{'Content-Type':'application/json','x-seekoffer-revalidate-token':env.NOTICE_REVALIDATE_TOKEN},body:'{"ids":[]}'});
  await invalidate();
  const api=base+'/api/public/notices/?page=1&pageSize=16';
  const first=await fetch(api);const body=await first.text();assert.equal(first.status,200);const parsed=JSON.parse(body);assert.equal(parsed.items.length,16);assert.equal(parsed.pagination.total,205);
  evidence.listBytes=Buffer.byteLength(body);assert.ok(evidence.listBytes<100_000);evidence.firstOriginRequests=requests.length;
  const version=first.headers.get('x-notice-version');assert.ok(version);
  await fetch(api);evidence.warmAdditionalOriginRequests=requests.length-evidence.firstOriginRequests;assert.equal(evidence.warmAdditionalOriginRequests,0);
  // A second OS process shares the on-disk Next data cache. It must not rescan.
  evidence.version=version;
  const second=spawn(process.execPath,[resolve(root,'node_modules/next/dist/bin/next'),'start','-p','33574','-H','127.0.0.1'],{env,windowsHide:true,stdio:'ignore'});
  try {
    for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:33574/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
    const prior=requests.length;
    const response=await fetch('http://127.0.0.1:33574/api/public/notices/?page=1&pageSize=16');
    assert.equal(response.status,200);assert.equal(response.headers.get('x-notice-version'),version);
    evidence.secondProcessAdditionalOriginRequests=requests.length-prior;assert.equal(requests.length,prior);
  } finally { second.kill(); }
  const beforeIds=requests.length;
  const idResult=await fetch(base+'/api/public/notices/by-ids/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:rows.slice(0,100).map(r=>r.id)})});assert.equal(idResult.status,200);assert.equal((await idResult.json()).items.length,100);assert.equal(requests.length-beforeIds,1);assert.ok(requests.at(-1).ids.startsWith('in.'));
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
  let external=0;await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external++;return route.abort();}return route.continue();});
  await page.goto(base+'/notices/');await page.getByText('2026年计算机推免招生通知 1',{exact:false}).first().waitFor();
  const welcome=page.getByRole('button',{name:'继续浏览网站'});if(await welcome.isVisible()){await welcome.click();await welcome.waitFor({state:'hidden'});}
  await page.screenshot({path:resolve(out,'main-notices.png'),fullPage:false});
  const input=page.locator('input').first();const beforeComposition=requests.length;await input.dispatchEvent('compositionstart');await input.fill('计算机');await page.waitForTimeout(450);assert.equal(requests.length,beforeComposition);await input.dispatchEvent('compositionend');await page.waitForTimeout(450);
  const beforeDetail=requests.length;await page.goto(base+'/notices/offline-0/');await page.getByText('离线固定样本正文',{exact:false}).first().waitFor();assert.ok(requests.slice(beforeDetail).every(r=>r.ids==='eq.offline-0'));
  await page.goto(base+'/notices/detail/?id=offline-0');assert.ok(page.url().includes('/notices/offline-0'));evidence.detailOriginRequests=requests.length-beforeDetail;
  rows=rows.filter(r=>r.id!=='offline-0');assert.equal((await invalidate()).status,200);const withdrawn=await fetch(base+'/notices/offline-0/');assert.equal(withdrawn.status,404);
  const listAfter=await(await fetch(api)).json();assert.equal(listAfter.pagination.total,204);assert.ok(!listAfter.items.some(r=>r.id==='offline-0'));
  evidence.withdrawal='list and detail absent after authenticated invalidation';
  status=402;await invalidate();const before402=requests.length;assert.equal((await fetch(api)).status,402);assert.equal((await fetch(api)).status,402);assert.equal(requests.length-before402,1);evidence.restrictedOriginRequests=requests.length-before402;
  // Static package: even with all nonlocal traffic blocked, lists and both details work.
  const staticUrl=`http://127.0.0.1:${staticPort}`;const staticRequests=[];page.on('request',r=>{if(r.url().startsWith(staticUrl))staticRequests.push(new URL(r.url()).pathname);});
  await page.goto(staticUrl+'/');await page.locator('article').first().waitFor();assert.equal(await page.locator('article').count(),16);assert.ok(!staticRequests.some(p=>/^\/data\/offline-/.test(p)));
  await page.getByRole('button',{name:'下一页'}).click();assert.ok(page.url().includes('page=2'));await page.locator('#region').selectOption('北京');assert.ok((await page.locator('#page').textContent()).includes('共 102 条'));
  await page.goto(staticUrl+'/notices/offline-0/');await page.locator('pre').waitFor();assert.equal(await page.locator('#controls').isVisible(),false);assert.equal(await page.locator('nav').isVisible(),false);await page.goto(staticUrl+'/notices/detail/?id=offline-1');await page.locator('pre').waitFor();
  await page.screenshot({path:resolve(out,'readonly-detail.png')});
  evidence.staticRequests=staticRequests;evidence.blockedExternalRequests=external;evidence.staticBrowsing='PASS';evidence.finishedAt=new Date().toISOString();
  await writeFile(resolve(out,'browser-evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await browser?.close();child.kill();origin.close();staticServer.close();await writeFile(resolve(out,'local-next.log'),log);}
