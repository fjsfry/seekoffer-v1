import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from '../../workers/seekoffer-api/node_modules/esbuild/lib/main.js';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from '../../workers/seekoffer-api/node_modules/miniflare/dist/src/index.js';

const out='artifacts/d1-migration/recovery-transport-workerd.mjs';
await build({stdin:{contents:`import {getRecoveryOverrides,getUpdatedRecoveryDetail} from './lib/server/recovery-notice-overrides';export default {async fetch(request){try{const p=new URL(request.url).pathname;const data=p==='/list'?await getRecoveryOverrides():await getUpdatedRecoveryDetail('synthetic-public');return Response.json(data);}catch(e){return Response.json({error:e.message},{status:e.status||500});}}};`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',external:['node:*'],outfile:out,logLevel:'silent',plugins:[{name:'server-only-in-worker',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'marker',namespace:'empty'}));b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'',loader:'js'}));}}]});
const checks=[];
for(const mode of ['success','redirect','restricted','missing']){
 const calls=[];
 const options=convertV4MiniflareOptions({cf:false,modules:true,scriptPath:out,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],log:new Log(LogLevel.ERROR),outboundService:request=>{const url=new URL(request.url);assert.equal(url.origin,'https://migration.seekoffer.com.cn');calls.push(url.pathname);if(mode==='redirect')return new Response(null,{status:302,headers:{Location:'https://unrelated.invalid'}});if(mode==='restricted')return Response.json({error:'restricted'},{status:402});if(mode==='missing')return Response.json({error:'missing'},{status:404});return Response.json(url.pathname.endsWith('notice-detail')?{id:'synthetic-public'}:{version:'fixture-v1',items:[],nextCursor:null});}});options.telemetry={enabled:false};const mf=new Miniflare(options);
 try{
  if(mode==='success'){assert.equal((await mf.dispatchFetch('http://localhost/list')).status,200);assert.equal((await (await mf.dispatchFetch('http://localhost/detail')).json()).id,'synthetic-public');assert.deepEqual(calls,['/v1/public/notice-overrides','/v1/public/notice-detail']);}
  if(mode==='redirect'){assert.equal((await mf.dispatchFetch('http://localhost/detail')).status,502);assert.equal(calls.length,1);}
  if(mode==='restricted'){assert.equal((await mf.dispatchFetch('http://localhost/list')).status,402);assert.equal((await mf.dispatchFetch('http://localhost/list')).status,503);assert.equal(calls.length,1);}
  if(mode==='missing'){assert.equal(await (await mf.dispatchFetch('http://localhost/detail')).json(),null);assert.equal(calls.length,1);}
  checks.push({mode,requests:calls.length,passed:true});
 }finally{await mf.dispose();}
}
// A warm complete version can skip later shards, but a changed version must
// finish all shards and a failed refresh must not expose the previous version.
{
 let phase='v1';const calls=[];
 const options=convertV4MiniflareOptions({cf:false,modules:true,scriptPath:out,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],log:new Log(LogLevel.ERROR),outboundService:request=>{
  const u=new URL(request.url);assert.equal(u.origin,'https://migration.seekoffer.com.cn');const after=u.searchParams.get('after');calls.push({phase,after});
  if(phase==='failed'&&after)return Response.json({error:'restricted'},{status:402});
  const version=phase==='failed'?'v3':phase;
  if(after){assert.equal(u.searchParams.get('version'),version);return Response.json({version,items:[{id:'b',visible:false}],nextCursor:null});}
  return Response.json({version,items:[{id:'a',visible:false}],nextCursor:'notice_override:a'});
 }});options.telemetry={enabled:false};const mf=new Miniflare(options);
 try{
  assert.equal((await mf.dispatchFetch('http://localhost/list')).status,200);assert.equal(calls.length,2);
  assert.equal((await mf.dispatchFetch('http://localhost/list')).status,200);assert.equal(calls.length,3);
  phase='v2';const changed=await(await mf.dispatchFetch('http://localhost/list')).json();assert.equal(changed.version,'v2');assert.equal(changed.items.length,2);assert.equal(calls.length,5);
  phase='failed';assert.equal((await mf.dispatchFetch('http://localhost/list')).status,402);assert.equal((await mf.dispatchFetch('http://localhost/list')).status,503);assert.equal(calls.length,7);
  checks.push({mode:'complete-version-shards',sameVersionAdditionalRequests:1,changedVersionRequests:2,failedVersionNotReused:true,passed:true});
 }finally{await mf.dispose();}
}
const receipt={at:new Date().toISOString(),state:'PASSED',runtime:'actual-workerd',checks,redirectsFollowed:0,remoteRequests:0,productionWrites:0};
fs.writeFileSync('artifacts/d1-migration/recovery-transport-verification.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
