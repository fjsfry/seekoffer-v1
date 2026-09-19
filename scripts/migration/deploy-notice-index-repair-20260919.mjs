import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {build} from '../../workers/seekoffer-api/node_modules/esbuild/lib/main.js';

// Bounded repair: replace only the deployed JS entry; keep all other modules,
// static assets, bindings, routes, secrets and the separate API Worker intact.
const account='9268f8c5fedc0f340356dcf729402a32';
const worker='seekoffer-next15-compatibility';
const expectedVersion='15a1bd72-0c0a-4aef-9a70-75043bd410ef';
const expectedSha='4afba22757923c182b2df9690daf22d83b491ae02c42dda5390885c4aa5ec8ad';
const dir='artifacts/notice-index-repair-20260919';
const credential=fs.readFileSync('C:/Users/Administrator/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
assert.ok(credential,'OFFICIAL_OAUTH_MISSING');
const hash=x=>createHash('sha256').update(x).digest('hex');
async function request(path,init={}){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{...init,headers:{Authorization:'Bearer '+credential,...init.headers},signal:AbortSignal.timeout(120000)});
 if(!r.ok){const j=await r.json().catch(()=>({}));throw Error('CF_HTTP_'+r.status+':'+(j.errors||[]).map(e=>e.code).join(','));}return r;
}
async function json(path,init){const j=await(await request(path,init)).json();assert.notEqual(j.success,false,'CF_API_FAILED');return j.result;}
const root='/workers/scripts/'+worker;
const latest=async name=>(await json('/workers/scripts/'+name+'/deployments')).deployments[0];
const before=await latest(worker),apiBefore=await latest('seekoffer-api-isolated-preview');
assert.deepEqual(before.versions,[{version_id:expectedVersion,percentage:100}],'LIVE_VERSION_CHANGED');
const settings=await json(root+'/settings');
assert.equal(settings.bindings.find(b=>b.name==='PUBLIC_WEBSITE_MODE')?.text,'live');
assert.equal(settings.bindings.find(b=>b.name==='CORE')?.id,'531486a7-f140-488e-8759-f77d885124f3');
const live=await(await request(root+'/content/v2')).formData();
assert.equal(hash(await live.get('worker.js').text()),expectedSha,'LIVE_SOURCE_CHANGED');
const output=await build({entryPoints:['workers/seekoffer-frontend/public-entry.ts'],bundle:true,format:'esm',platform:'browser',minify:true,write:false,logLevel:'silent'});
const candidate=output.outputFiles[0].contents;
const parts=[],form=new FormData();
for(const [name,value] of live.entries()){
 assert.equal(typeof value,'object','UNEXPECTED_MODULE');
 const bytes=Buffer.from(await value.arrayBuffer());
 parts.push({name,type:value.type,sha256:hash(bytes),bytes:bytes.length});
 form.append(name,name==='worker.js'?new Blob([candidate],{type:'application/javascript+module'}):value,name);
}
const metadata={main_module:'worker.js',keep_assets:true,keep_bindings:['secret_text'],bindings:settings.bindings.filter(b=>b.type!=='secret_text').map(b=>b.type==='d1'?{name:b.name,type:b.type,id:b.id}:b),compatibility_date:settings.compatibility_date,compatibility_flags:settings.compatibility_flags,usage_model:settings.usage_model,tags:settings.tags,tail_consumers:settings.tail_consumers,logpush:settings.logpush,assets:{config:{run_worker_first:true}},annotations:{'workers/message':'Repair notice index cold refresh subrequest budget (2026-09-19)'}};
form.set('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
fs.mkdirSync(dir,{recursive:true});
const receipt={at:new Date().toISOString(),worker,beforeVersion:expectedVersion,oldEntrySha256:expectedSha,newEntrySha256:hash(candidate),preservedModules:parts.filter(p=>p.name!=='worker.js'),keepAssets:true,keepSecrets:true,databaseWrites:0};
fs.writeFileSync(dir+'/candidate-worker.js',candidate);
fs.writeFileSync(dir+'/deployment-preflight.json',JSON.stringify(receipt,null,2));
assert.equal(JSON.parse(fs.readFileSync(dir+'/index-verification.json')).state,'REVIEWED_INDEX_LOCAL_PASSED');
if(!process.argv.includes('--deploy')){console.log(JSON.stringify({...receipt,preservedModules:receipt.preservedModules.length,state:'PREFLIGHT_PASSED'}));process.exit(0);}
assert.ok(!fs.existsSync(dir+'/deployment-attempt.json'),'DEPLOY_ATTEMPT_ALREADY_EXISTS_CHECK_REMOTE_FIRST');
fs.writeFileSync(dir+'/deployment-attempt.json',JSON.stringify({at:new Date().toISOString(),beforeVersion:expectedVersion,newEntrySha256:hash(candidate)},null,2));
await json(root,{method:'PUT',body:form});
const after=await latest(worker),apiAfter=await latest('seekoffer-api-isolated-preview');
assert.deepEqual(apiAfter.versions,apiBefore.versions,'UNRELATED_API_CHANGED');
const newSettings=await json(root+'/settings');
const canonical=b=>JSON.stringify([...b].sort((a,b)=>a.name.localeCompare(b.name)).map(b=>Object.fromEntries(Object.entries(b).sort())));
assert.equal(canonical(newSettings.bindings),canonical(settings.bindings),'BINDINGS_CHANGED');
const deployed=await(await request(root+'/content/v2')).formData();
assert.equal(hash(await deployed.get('worker.js').text()),hash(candidate),'ENTRY_VERIFICATION_FAILED');
for(const part of receipt.preservedModules)assert.equal(hash(Buffer.from(await deployed.get(part.name).arrayBuffer())),part.sha256,'MODULE_CHANGED:'+part.name);
const result={...receipt,state:'DEPLOYED_VERIFIED',deployment:after.id,versions:after.versions,preservedModules:receipt.preservedModules.length,bindingsUnchanged:true,separateApiUnchanged:true};
fs.writeFileSync(dir+'/deployment-receipt.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
