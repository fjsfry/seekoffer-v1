import fs from 'node:fs';import path from 'node:path';import net from 'node:net';import crypto from 'node:crypto';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const root=process.cwd(),exe=path.join(root,'src-tauri/target/release/seekoffer-desktop.exe'),out=path.join(root,'artifacts/d1-migration');fs.mkdirSync(out,{recursive:true});
const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
// This child is the separately identified acceptance app. No installed browser profile,
// application credentials, browser cookies or other user's running process is accessed.
const profile=path.join(out,'webview-fixture-'+crypto.randomUUID());fs.mkdirSync(profile);
const child=spawn(exe,[],{cwd:path.dirname(exe),windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-address=127.0.0.1 --remote-debugging-port=${port}`}});
let browser;try{
 const base='http://127.0.0.1:'+port;let ready=false;
 for(let i=0;i<45;i++){try{const r=await fetch(base+'/json/version',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
 assert.ok(ready,'ACCEPTANCE_WEBVIEW_DEBUG_ENDPOINT_NOT_READY:childExit='+child.exitCode);browser=await chromium.connectOverCDP(base);
 let page;for(let i=0;i<30;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://tauri.localhost')&&!p.url().includes('desktop-splash'));if(page)break;await new Promise(r=>setTimeout(r,500));}
 assert.ok(page,'ACCEPTANCE_MAIN_WINDOW_NOT_FOUND');const errors=[],blocked=[];page.on('pageerror',e=>errors.push(e.message.replace(/https?:\/\/\S+/g,'[url]').slice(0,160)));
 await page.route(/https:\/\/[^/]*supabase\.(co|com)\//,r=>{blocked.push(new URL(r.request().url()).hostname);return r.abort();});
 await page.waitForFunction(()=>Boolean(window.__TAURI_INTERNALS__?.invoke),null,{timeout:15000});
 const result=await page.evaluate(async()=>{
  const invoke=window.__TAURI_INTERNALS__.invoke;
  const started=performance.now();const data=await invoke('native_public_request',{path:'/api/public/notices/?page=1&pageSize=16&year=2026&sort=publish',method:'GET',body:null});
  const id=data.items?.[0]?.id;if(!id)throw Error('PUBLIC_NATIVE_LIST_EMPTY');
  const detail=await invoke('native_public_request',{path:'/v1/public/notice-detail?id='+encodeURIComponent(id),method:'GET',body:null});
  let scopeRejected=false;try{await invoke('native_public_request',{path:'https://unrelated.invalid/',method:'GET',body:null});}catch{scopeRejected=true;}
  return{count:data.items.length,total:data.pagination?.total,bytes:new TextEncoder().encode(JSON.stringify(data)).length,detailIdMatches:detail?.id===id,scopeRejected,elapsedMs:Math.round(performance.now()-started),buttons:[...document.querySelectorAll('button')].map(b=>b.textContent?.trim()).filter(Boolean).slice(0,30)};
 });
 assert.equal(result.count,16);assert.equal(result.detailIdMatches,true);assert.equal(result.scopeRejected,true);assert.equal(blocked.length,0);
 await page.screenshot({path:path.join(out,'native-acceptance-startup.png'),fullPage:false});
 const report={at:new Date().toISOString(),layer:'built-release-exe-WebView2-native-Rust-public-HTTP',identifier:'com.seekoffer.desktop.d1acceptance',exeBytes:fs.statSync(exe).size,exeSHA256:crypto.createHash('sha256').update(fs.readFileSync(exe)).digest('hex'),supabaseRequests:blocked.length,privateDataRead:false,authLogin:'PENDING_HUMAN_ACCEPTANCE',productionClientPublished:false,errors,...result};
 fs.writeFileSync(path.join(out,'native-acceptance-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.log(JSON.stringify({state:'NATIVE_ACCEPTANCE_FAILED',error:e instanceof assert.AssertionError?e.message:String(e.message).split('\n')[0].slice(0,180)}));process.exitCode=1;}finally{if(browser)await browser.close();if(child.exitCode===null)child.kill();}
