import fs from 'node:fs';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {build} from '../../workers/seekoffer-api/node_modules/esbuild/lib/main.js';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from '../../workers/seekoffer-api/node_modules/miniflare/dist/src/index.js';
import {runDailyDigest} from '../../functions/wechat-daily-digest/digest-core.mjs';
const out='artifacts/d1-migration/wechat-ledger-workerd.mjs',secret='SYNTHETIC_ONLY_WECHAT_LEDGER_SECRET_0123456789';
await build({entryPoints:['workers/seekoffer-api/src/snapshot-worker.ts'],bundle:true,format:'esm',platform:'browser',external:['node:*'],outfile:out,logLevel:'silent'});
const options=convertV4MiniflareOptions({cf:false,modules:true,scriptPath:out,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:{CORE:'synthetic-wechat-ledger'},d1Persist:false,log:new Log(LogLevel.ERROR),bindings:{MODE:'local',BUSINESS_WRITES_ENABLED:'true',ALLOWED_ORIGINS:'http://127.0.0.1',WECHAT_LEDGER_ENABLED:'true',WECHAT_LEDGER_SECRET:secret},outboundService:()=>{throw Error('NO_REAL_NETWORK');}});options.telemetry={enabled:false};const mf=new Miniflare(options);
try{
 const db=await mf.getD1Database('CORE');const p=spawnSync('python',['-c',"import json,sqlite3,pathlib,sys\na=[];b=''\nfor p in sys.argv[1:]:\n for c in pathlib.Path(p).read_text('utf-8-sig'):\n  b+=c\n  if c==';' and sqlite3.complete_statement(b):a.append(b);b=''\nprint(json.dumps(a))",'migrations/d1/snapshot/0001_business.sql','migrations/d1/snapshot/0002_preview_runtime.sql','migrations/d1/snapshot/0003_payment_transactions.sql'],{encoding:'utf8',windowsHide:true,maxBuffer:1e6});assert.equal(p.status,0);const statements=JSON.parse(p.stdout);for(let i=0;i<statements.length;i+=20)await db.batch(statements.slice(i,i+20).map(s=>db.prepare(s)));
 const api=async(body,token=secret)=>mf.dispatchFetch('http://127.0.0.1/v1/internal/wechat-publications',{method:'POST',headers:{'Content-Type':'application/json','X-Wechat-Ledger-Secret':token},body:JSON.stringify(body)});
 assert.equal((await api({action:'get',date:'2026-09-10'},'bad')).status,401);assert.equal((await api({action:'get',date:'2026-02-31'})).status,400);
 let date='2026-09-10',draftCalls=0,mode='normal',lostOnce=false;
 const fetcher=async(input,init={})=>{
  const url=new URL(input);
  if(url.origin==='https://migration.seekoffer.com.cn'){
   const body=JSON.parse(init.body);assert.equal(init.headers['X-Wechat-Ledger-Secret'],secret);const r=await api(body);
   if(mode==='lost-ledger-response'&&body.action==='complete'&&body.patch.status==='drafted'&&!lostOnce){assert.equal(r.status,200);lostOnce=true;throw Error('SYNTHETIC_RESPONSE_LOST');}return r;
  }
  if(url.origin==='https://www.seekoffer.com.cn')return Response.json({items:[{id:'synthetic-'+date,schoolName:'合成大学',departmentName:'测试学院',projectName:'2026保研报名通知',projectType:'预推免',publishDate:date,deadlineDate:'2026-09-30',sourceLink:'https://example.edu.cn/notice',applyLink:'https://example.edu.cn/apply'}],pagination:{total:1,page:1}},{headers:{'X-Notice-Version':'synthetic-v1'}});
  if(url.origin==='https://api.weixin.qq.com'&&url.pathname.endsWith('/stable_token'))return Response.json({access_token:'SYNTHETIC_ACCESS_TOKEN'});
  if(url.origin==='https://api.weixin.qq.com'&&url.pathname.endsWith('/draft/add')){draftCalls++;if(mode==='lost-provider-response')throw Error('SYNTHETIC_PROVIDER_RESPONSE_LOST');return Response.json({media_id:'SYNTHETIC_MEDIA_'+date});}
  throw Error('UNEXPECTED_EXTERNAL_CALL');
 };
 const env={SEEKOFFER_DIGEST_BACKEND:'d1',WECHAT_LEDGER_SECRET:secret,WECHAT_MP_APP_ID:'SYNTHETIC_APP',WECHAT_MP_APP_SECRET:'SYNTHETIC_SECRET',WECHAT_MP_THUMB_MEDIA_ID:'SYNTHETIC_THUMB',SEEKOFFER_SITE_URL:'https://www.seekoffer.com.cn'};
 const run=(force=false)=>runDailyDigest({event:{targetDate:date,force},env,fetchImpl:fetcher});
 const first=await run();assert.equal(first.ok,true);assert.equal(draftCalls,1);assert.equal((await run()).skipped,true);assert.equal(draftCalls,1);
 const publication=(await(await api({action:'get',date})).json()).publication;assert.equal(publication.status,'drafted');
 const token=JSON.parse(publication.ledger_state).token,done={status:'drafted',wechat_media_id:first.mediaId,wechat_thumb_media_id:first.thumbMediaId,error_code:'',error_message:''};
 const replay=await api({action:'complete',date,token,patch:done});assert.equal(replay.status,200);assert.equal(Number(replay.headers.get('x-d1-rows-written')),0);
 const payload={digest_date:date,status:'preparing',notice_count:1,included_notice_count:1,notice_ids:['synthetic-'+date],article_title:'合成稿件',article_digest:'测试',content_source_url:'https://www.seekoffer.com.cn/notices/?date='+date,content_html:'<p>测试</p>',error_code:'',error_message:'',metadata:{}};
 const expected={updated_at:publication.updated_at,status:publication.status,ledger_state:publication.ledger_state};
 const race=await Promise.all([api({action:'claim',date,expected,payload}),api({action:'claim',date,expected,payload})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 const winner=await race.find(r=>r.status===200).json();const failedBody={action:'complete',date,token:winner.token,patch:{status:'failed',error_code:'SYNTHETIC_PRE_PROVIDER_ERROR',error_message:'No provider call'}};const completeRace=await Promise.all([api(failedBody),api(failedBody)]);assert.ok(completeRace.every(r=>r.status===200));
 date='2026-09-11';mode='lost-provider-response';await assert.rejects(run(),/SYNTHETIC_PROVIDER_RESPONSE_LOST/);const unknown=(await(await api({action:'get',date})).json()).publication;assert.equal(unknown.status,'preparing');assert.equal(JSON.parse(unknown.ledger_state).phase,'uncertain');const before=draftCalls;assert.equal((await run(true)).skipped,true);assert.equal(draftCalls,before);
 date='2026-09-12';mode='lost-ledger-response';await assert.rejects(run(),/SYNTHETIC_RESPONSE_LOST/);assert.equal((await(await api({action:'get',date})).json()).publication.status,'drafted');assert.equal((await run()).skipped,true);assert.equal(draftCalls,before+1);
 const budgetDay='wechat_jobs_day:'+new Date().toISOString().slice(0,10);await db.prepare('UPDATE _runtime_state SET value=? WHERE key=?').bind('6',budgetDay).run();date='2026-09-13';assert.equal((await api({action:'claim',date,expected:null,payload:{...payload,digest_date:date}})).status,402);
 await db.prepare('UPDATE _runtime_state SET value=? WHERE key=?').bind('0',budgetDay).run();assert.equal((await api({action:'claim',date,expected:null,payload:{...payload,digest_date:date,content_source_url:'invalid'}})).status,400);
 await db.prepare("CREATE TRIGGER synthetic_wechat_failure BEFORE INSERT ON main__wechat_daily_publications BEGIN SELECT RAISE(ABORT,'synthetic ledger failure'); END").run();assert.equal((await api({action:'claim',date,expected:null,payload:{...payload,digest_date:date}})).status,503);assert.equal(await db.prepare('SELECT value FROM _runtime_state WHERE key=?').bind(budgetDay).first('value'),'0');assert.equal(await db.prepare('SELECT count(*) n FROM _business_transaction_guards').first('n'),0);
 const report={at:new Date().toISOString(),state:'PASSED',runtime:'actual-local-workerd-D1-plus-digest-runner',existingPublishedDraftPreserved:true,concurrentForceSingleWinner:true,concurrentCompletionIdempotent:true,completedReceiptReplayWrites:0,unknownProviderResultStopsRepublishing:true,lostDatabaseResponseDoesNotRepeatDraft:true,dailyJobsBounded:true,failedBatchRollsBack:true,unauthorizedRejected:true,syntheticProviderDraftCalls:draftCalls,realWechatRequests:0,supabaseRequests:0,remoteWrites:0,productionLedgerEnabled:false};fs.writeFileSync('artifacts/d1-migration/wechat-ledger-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await mf.dispose();}
