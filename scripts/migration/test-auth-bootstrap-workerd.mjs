import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
import {build} from '../../workers/seekoffer-api/node_modules/esbuild/lib/main.js';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from '../../workers/seekoffer-api/node_modules/miniflare/dist/src/index.js';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const output=path.resolve('artifacts/d1-migration/auth-bootstrap-workerd.mjs');
await build({stdin:{contents:`import {bootstrapIdentity} from './workers/seekoffer-api/src/identity-bootstrap.ts';
export default {async fetch(request,env){const route=new URL(request.url).pathname;try{if(route==='/legacy'){new Request('https://api.clerk.com/v1/users/user_synthetic',{redirect:'error'});return Response.json({unexpectedlyAccepted:true});}
 const subject=route==='/redirect'?'user_redirect':'user_runtime';const result=await bootstrapIdentity(env.CORE,{issuer:env.CLERK_ISSUER,subject},env);return Response.json(result);
 }catch(error){return Response.json({error:error.message},{status:error.status||500});}}};`,resolveDir:process.cwd(),sourcefile:'auth-bootstrap-runtime-fixture.ts'},bundle:true,format:'esm',platform:'browser',outfile:output,logLevel:'silent'});
const requests=[];const options=convertV4MiniflareOptions({cf:false,modules:true,scriptPath:output,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:{CORE:'synthetic-auth-bootstrap'},d1Persist:false,bindings:{CLERK_ISSUER:'https://clerk.seekoffer.com.cn',CLERK_BACKEND_SECRET:'sk_live_synthetic_runtime',NEW_ACCOUNTS_ENABLED:'true',NEW_ACCOUNTS_FROM:'2026-09-09T00:00:00Z'},log:new Log(LogLevel.ERROR),outboundService:request=>{
 const url=new URL(request.url);requests.push({origin:url.origin,path:url.pathname});assert.equal(url.origin,'https://api.clerk.com');assert.equal(request.headers.get('authorization'),'Bearer sk_live_synthetic_runtime');
 if(url.pathname.endsWith('user_redirect'))return new Response(null,{status:302,headers:{Location:'https://untrusted.example.invalid/collect'}});
 return Response.json({id:'user_runtime',external_id:null,banned:false,locked:false,created_at:Date.parse('2026-09-09T01:00:00Z'),primary_email_address_id:'email_synthetic',email_addresses:[{id:'email_synthetic',verification:{status:'verified'}}]});
 }});options.telemetry={enabled:false};const mf=new Miniflare(options);
try{
 const db=await mf.getD1Database('CORE');
 const parsed=spawnSync('python',['-c',"import json,sqlite3,sys,pathlib\nstatements=[]\nbuffer=''\nfor name in sys.argv[1:]:\n for ch in pathlib.Path(name).read_text(encoding='utf-8-sig'):\n  buffer+=ch\n  if ch==';' and sqlite3.complete_statement(buffer):\n   statements.append(buffer);buffer=''\nprint(json.dumps(statements))",'migrations/d1/snapshot/0001_business.sql','migrations/d1/snapshot/0002_preview_runtime.sql'],{encoding:'utf8',windowsHide:true,maxBuffer:1000000});if(parsed.status)throw Error('LOCAL_SCHEMA_PARSE_FAILED');
 const schema=JSON.parse(parsed.stdout);for(let i=0;i<schema.length;i+=20)await db.batch(schema.slice(i,i+20).map(sql=>db.prepare(sql)));
 const legacy=await(await mf.dispatchFetch('http://127.0.0.1/legacy')).json();assert.match(legacy.error,/Invalid redirect value/);assert.equal(requests.length,0);
 const first=await mf.dispatchFetch('http://127.0.0.1/valid'),user=await first.json();assert.equal(first.status,200);assert.equal(user.created,true);assert.equal(requests.length,1);
 const retry=await(await mf.dispatchFetch('http://127.0.0.1/valid')).json();assert.equal(retry.userId,user.userId);assert.equal(retry.created,false);assert.equal(requests.length,1);
 const denied=await mf.dispatchFetch('http://127.0.0.1/redirect');assert.equal(denied.status,503);assert.equal(requests.length,2);assert.ok(requests.every(r=>r.origin==='https://api.clerk.com'));
 const profiles=await db.prepare('SELECT count(*) AS n FROM main__profiles').first();assert.equal(profiles.n,1);
 const receipt={at:new Date().toISOString(),runtime:'actual-local-workerd-and-D1-binding',legacyRedirectModeRejected:true,newUserProfileCreated:true,retryPreservesIdentity:true,redirectNeverFollowed:true,externalNetworkRequests:0,simulatedClerkRequests:requests.length,source:'current identity-bootstrap.ts'};
 fs.writeFileSync('artifacts/d1-migration/auth-bootstrap-workerd-verification.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await mf.dispose();}
