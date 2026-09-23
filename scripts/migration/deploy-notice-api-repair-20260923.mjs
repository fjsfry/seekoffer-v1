import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Authorized repair of one reader in the exact accepted release bundle.
// Never deploy the full source tree: it includes unrelated unreleased changes.
const account='9268f8c5fedc0f340356dcf729402a32';
const worker='seekoffer-api-isolated-preview';
const zone='82eca6dd8e89e5a1c0c87e514536383a';
const previousVersion='51db5cb4-19ac-4957-834b-1d44d2bccbef';
const previousHash='197f013356e21979a1ec8f2aff2a7bb991451e07ed1485a703fdcf309b7c4dc8';
const dir='artifacts/notice-api-deploy-20260923';
const hash=x=>createHash('sha256').update(x).digest('hex');
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort()):v);
const sortedBindings=bindings=>canonical([...bindings].sort((a,b)=>a.name.localeCompare(b.name)));
const token=fs.readFileSync('C:/Users/Administrator/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
assert.ok(token,'OFFICIAL_OAUTH_MISSING');
const base='/accounts/'+account, root=base+'/workers/scripts/'+worker;
async function request(p,init={}) {
  const r=await fetch('https://api.cloudflare.com/client/v4'+p,{...init,headers:{Authorization:'Bearer '+token,...init.headers},signal:AbortSignal.timeout(60000)});
  if(!r.ok){const j=await r.json().catch(()=>({}));throw Error('CF_HTTP_'+r.status+':'+(j.errors||[]).map(e=>e.code).join(','));}
  return r;
}
async function json(p,init){const j=await(await request(p,init)).json();assert.notEqual(j.success,false,'CF_API_FAILED');return j.result;}
const latest=async name=>(await json(base+'/workers/scripts/'+name+'/deployments')).deployments[0];
const candidate=fs.readFileSync(dir+'/candidate-acceptance-worker.js');
const preflight=JSON.parse(fs.readFileSync(dir+'/candidate-preflight.json','utf8'));
assert.equal(hash(candidate),preflight.newEntrySha256,'CANDIDATE_HASH_MISMATCH');
const [before,settings,domains,routes,frontend]=await Promise.all([latest(worker),json(root+'/settings'),json(base+'/workers/domains'),json('/zones/'+zone+'/workers/routes'),latest('seekoffer-next15-compatibility')]);
assert.deepEqual(before.versions,[{version_id:previousVersion,percentage:100}],'LIVE_VERSION_CHANGED');
assert.equal(settings.bindings.find(b=>b.name==='CORE')?.id,'531486a7-f140-488e-8759-f77d885124f3','D1_BINDING_CHANGED');
assert.equal(domains.find(d=>d.hostname==='migration.seekoffer.com.cn')?.service,worker,'API_ROUTE_CHANGED');
const live=await(await request(root+'/content/v2')).formData();
assert.equal([...live.entries()].length,1,'UNEXPECTED_MODULE_SET');
assert.equal(hash(Buffer.from(await live.get('acceptance-worker.js').arrayBuffer())),previousHash,'LIVE_SOURCE_CHANGED');
const metadata={
  main_module:'acceptance-worker.js', keep_bindings:['secret_text'],
  bindings:settings.bindings.filter(b=>b.type!=='secret_text').map(b=>b.type==='d1'?{name:b.name,type:b.type,id:b.id}:b),
  compatibility_date:settings.compatibility_date,compatibility_flags:settings.compatibility_flags,
  usage_model:settings.usage_model,tags:settings.tags,tail_consumers:settings.tail_consumers,
  logpush:settings.logpush,placement:settings.placement,
  annotations:{'workers/message':'Repair notice override capacity with bounded keyset pages (2026-09-23)'}
};
const form=new FormData();
form.append('acceptance-worker.js',new Blob([candidate],{type:'application/javascript+module'}),'acceptance-worker.js');
form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
if(!process.argv.includes('--deploy')){console.log(JSON.stringify({state:'REMOTE_PREFLIGHT_PASSED',previousVersion,candidateSha256:hash(candidate),bindings:settings.bindings.length,route:'migration.seekoffer.com.cn'}));process.exit(0);}
const verification=JSON.parse(fs.readFileSync(dir+'/candidate-verification.json','utf8'));
assert.equal(verification.state,'EXACT_CANDIDATE_WORKERD_VERIFIED','CANDIDATE_NOT_TESTED');
assert.equal(verification.candidateSha256,hash(candidate),'TESTED_CANDIDATE_CHANGED');
assert.ok(!fs.existsSync(dir+'/deployment-attempt.json'),'DEPLOY_ATTEMPT_EXISTS_INSPECT_REMOTE_BEFORE_RETRY');
fs.writeFileSync(dir+'/deployment-attempt.json',JSON.stringify({at:new Date().toISOString(),previousVersion,candidateSha256:hash(candidate)},null,2));
await json(root,{method:'PUT',body:form});
const [after,newSettings,newDomains,newRoutes,newFrontend]=await Promise.all([latest(worker),json(root+'/settings'),json(base+'/workers/domains'),json('/zones/'+zone+'/workers/routes'),latest('seekoffer-next15-compatibility')]);
assert.equal(sortedBindings(newSettings.bindings),sortedBindings(settings.bindings),'BINDINGS_CHANGED');
for(const key of ['compatibility_date','compatibility_flags','usage_model','tags','tail_consumers','logpush','placement'])assert.equal(canonical(newSettings[key]),canonical(settings[key]),'RUNTIME_CHANGED:'+key);
assert.equal(canonical(newDomains),canonical(domains),'DOMAINS_CHANGED');
assert.equal(canonical(newRoutes),canonical(routes),'ROUTES_CHANGED');
assert.deepEqual(newFrontend.versions,frontend.versions,'FRONTEND_VERSION_CHANGED');
const deployed=await(await request(root+'/content/v2')).formData();
assert.equal([...deployed.entries()].length,1,'MODULE_SET_CHANGED');
assert.equal(hash(Buffer.from(await deployed.get('acceptance-worker.js').arrayBuffer())),hash(candidate),'DEPLOYED_HASH_MISMATCH');
const receipt={at:new Date().toISOString(),state:'DEPLOYED_VERIFIED',worker,previousVersion,versions:after.versions,deployment:after.id,oldEntrySha256:previousHash,newEntrySha256:hash(candidate),bindingsUnchanged:true,routesUnchanged:true,runtimeUnchanged:true,frontendUnchanged:true,databaseWrites:0};
fs.writeFileSync(dir+'/deployment-receipt.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
