import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';import {build} from 'esbuild';
const root=new URL('../../../',import.meta.url);
await build({entryPoints:[fileURLToPath(new URL('snapshot-entry.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(new URL('artifacts/d1-migration/snapshot-runtime-tests.mjs',root)),tsconfig:fileURLToPath(new URL('tsconfig.json',root)),logLevel:'silent'});
const {createSnapshotWorker,createNoticeProjection,noticeSql,filterAndSortNotices,mapNoticeRowToProject,filterMainNoticeProjects,createAcceptanceWorker,ApiError,createD1BackendClient,createApplicationWorkspace,bootstrapIdentity,createClerkAuthFlow,readOrInitializeProfile,adminAction,requireSnapshotAdmin}=await import(new URL('artifacts/d1-migration/snapshot-runtime-tests.mjs',root));
const base=fs.readFileSync(new URL('migrations/d1/snapshot/0001_business.sql',root),'utf8'),runtime=fs.readFileSync(new URL('migrations/d1/snapshot/0002_preview_runtime.sql',root),'utf8');
const ownerA='00000000-0000-4000-8000-000000000001',ownerB='00000000-0000-4000-8000-000000000002';
const superAdmin={email:'admin@example.invalid',name:'Synthetic admin',role:'super_admin',status:'active',ownerId:ownerA};
function offerInput(){return{requestId:crypto.randomUUID(),contentType:'offer',authorName:'PRIVATE_AUTHOR_NAME',schoolName:'北京大学',major:'计算机',projectType:'预推免',result:'录取',undergraduateBackground:'合成测试背景',content:'这是一条仅在隔离测试数据库使用的测试动态。',isAnonymous:true};}
test('community submissions require review; public API hides authors, ownership and review notes',async()=>{
 const {db,request,env}=setup(),payload=offerInput();const first=await request('/v1/me/community/posts','POST',payload);assert.equal(first.status,200);assert.equal((await first.json()).reviewStatus,'pending');assert.equal((await(await request('/v1/community/posts')).json()).items.length,0);
 await adminAction(env.CORE,superAdmin,{resource:'offers',action:'update_status',id:payload.requestId,status:'approved',note:'PRIVATE_REVIEW_NOTE'},true);
 const response=await request('/v1/community/posts'),raw=await response.text();assert.ok(!raw.includes('PRIVATE_AUTHOR_NAME'));assert.ok(!raw.includes('PRIVATE_REVIEW_NOTE'));assert.ok(!raw.includes(ownerA));assert.equal(JSON.parse(raw).items.length,1);
 const again=await request('/v1/me/community/posts','POST',payload);assert.equal(again.status,200);assert.equal(db.prepare('SELECT count(*) AS n FROM main__offer_posts').get().n,1);
 assert.equal((await request('/v1/me/community/posts','POST',{...payload,content:'这是一段与原内容不同的重复请求，必须拒绝。'})).status,409);db.close();
});
test('community comments, follows and reports are replay safe and hidden parents do not expose replies',async()=>{
 const {db,request,env}=setup(),post=offerInput();await request('/v1/me/community/posts','POST',post);await adminAction(env.CORE,superAdmin,{resource:'offers',action:'update_status',id:post.requestId,status:'approved'},true);
 const comment={requestId:crypto.randomUUID(),postId:post.requestId,authorName:'PRIVATE_REPLY_AUTHOR',content:'合成回复内容',isAnonymous:true};await request('/v1/me/community/comments','POST',comment);await request('/v1/me/community/comments','POST',comment);
 const follow={postId:post.requestId,follow:true};await request('/v1/me/community/follows','POST',follow);await request('/v1/me/community/follows','POST',follow);
 const report={requestId:crypto.randomUUID(),postId:post.requestId,content:'这是一条合成举报原因，仅用于测试。'};await request('/v1/community/report','POST',report);await request('/v1/community/report','POST',report);
 const counts=db.prepare('SELECT comments_count,follows_count,reports_count FROM main__offer_posts WHERE id=?').get(post.requestId);assert.deepEqual({...counts},{comments_count:1,follows_count:1,reports_count:1});
 assert.ok(!(await(await request('/v1/community/comments?postId='+post.requestId)).text()).includes('PRIVATE_REPLY_AUTHOR'));
 assert.equal((await(await request('/v1/me/community/follows','GET',undefined,'b')).json()).ids.length,0);
 await adminAction(env.CORE,superAdmin,{resource:'offers',action:'update_status',id:post.requestId,status:'hidden'},true);assert.equal((await request('/v1/community/comments?postId='+post.requestId)).status,404);assert.equal((await(await request('/v1/community/posts')).json()).items.length,0);db.close();
});
test('community rate limits are persisted, privilege fields are rejected, and anonymous reports have a bounded slot',async()=>{
 const {db,request,worker,env}=setup();for(let i=0;i<5;i++)assert.equal((await request('/v1/me/community/posts','POST',offerInput())).status,200);assert.equal((await request('/v1/me/community/posts','POST',offerInput())).status,429);assert.equal((await request('/v1/me/community/posts','POST',{...offerInput(),review_status:'approved'})).status,400);
 const post=db.prepare('SELECT id FROM main__offer_posts LIMIT 1').get();await adminAction(env.CORE,superAdmin,{resource:'offers',action:'update_status',id:post.id,status:'approved'},true);env.PREVIEW_ACCESS_TOKEN='synthetic-opaque-rate-key';
 const report={postId:post.id,content:'匿名测试举报原因，不能无限重复提交。'};const anon=(content)=>worker.fetch(new Request('http://127.0.0.1/v1/community/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...report,content})}),env);
 assert.equal((await anon(report.content)).status,200);assert.equal((await anon(report.content)).status,200);assert.equal((await anon('另一条匿名举报内容应该受到次数限制。')).status,429);db.close();
});
test('admin scope, role permissions, audit rollback and deleted-account access are enforced',async()=>{
 const {db,env,request}=setup();await assert.rejects(()=>adminAction(env.CORE,{...superAdmin,role:'readonly_admin'},{resource:'offers',action:'update_status',id:'x',status:'approved'},true),/ADMIN_PERMISSION_DENIED/);
 const p=offerInput();await request('/v1/me/community/posts','POST',p);db.exec("CREATE TRIGGER fixture_log_failure BEFORE INSERT ON main__admin_operation_logs BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END");await assert.rejects(()=>adminAction(env.CORE,superAdmin,{resource:'offers',action:'update_status',id:p.requestId,status:'approved'},true));assert.equal(db.prepare('SELECT review_status FROM main__offer_posts WHERE id=?').get(p.requestId).review_status,'pending');db.exec('DROP TRIGGER fixture_log_failure');
 await adminAction(env.CORE,superAdmin,{resource:'users',action:'update_status',id:ownerB,status:'deleted'},true);assert.equal((await request('/v1/me/profile','GET',undefined,'b')).status,403);
 const user={id:'user_admin',external_id:null,banned:false,locked:false,primary_email_address_id:'email_a',email_addresses:[{id:'email_a',email_address:'admin@example.invalid',verification:{status:'verified'}}]};db.prepare('INSERT INTO main__admin_users(email,user_id,role) VALUES(?,?,?)').run('admin@example.invalid',ownerA,'super_admin');
 const config={CLERK_ISSUER:'https://clerk.seekoffer.com.cn',CLERK_BACKEND_SECRET:'sk_live_synthetic'};const identity={issuer:config.CLERK_ISSUER,subject:user.id};assert.equal((await requireSnapshotAdmin(env.CORE,ownerA,identity,config,async()=>Response.json(user))).role,'super_admin');await assert.rejects(()=>requireSnapshotAdmin(env.CORE,ownerB,identity,config,async()=>Response.json(user)),/ADMIN_REQUIRED/);db.close();
});
test('notice moderation updates a versioned override atomically, rejects private manual publication, and prevents resurrection',async()=>{
 const {db,env,request}=setup(),id='notice-001';const initial=await(await request('/v1/public/notice-overrides')).json();await adminAction(env.CORE,superAdmin,{resource:'notices',action:'update_status',id,status:'hidden'},true);
 const hidden=await(await request('/v1/public/notice-overrides')).json();assert.equal(hidden.items.find(i=>i.id===id).visible,false);assert.notEqual(hidden.version,initial.version);assert.equal((await request('/v1/public/notice-detail?id='+id)).status,404);assert.equal((await request('/v1/public/notice-overrides?version='+initial.version)).status,409);
 await adminAction(env.CORE,superAdmin,{resource:'notices',action:'update_status',id,status:'published'},true);const visible=await(await request('/v1/public/notice-overrides')).json();assert.equal(visible.items.find(i=>i.id===id).summary.id,id);assert.ok(!JSON.stringify(visible).includes('PRIVATE_ADMIN_NOTE'));assert.equal((await request('/v1/public/notice-detail?id='+id)).status,200);
 const manual=await(await request('/v1/me/manual-projects','POST',{requestId:crypto.randomUUID(),project:{schoolName:'私人大学',projectName:'私人申请',projectType:'预推免'}})).json();await assert.rejects(()=>adminAction(env.CORE,superAdmin,{resource:'notices',action:'update_status',id:manual.projectId,status:'published'},true),/PRIVATE_PROJECT_CANNOT_BE_PUBLISHED/);db.close();
});
test('admin read contracts run against real schema and suspended analytics returns unknown instead of zero',async()=>{
 const {db,env}=setup();for(const resource of ['overview','analytics','offers','feedback','notices','logs','settings','ai_waitlist','crawlers']){const result=await adminAction(env.CORE,superAdmin,{resource,action:'list'},false);assert.ok(result);}
 const dashboard=await adminAction(env.CORE,superAdmin,{resource:'dashboard',action:'snapshot'},false);assert.equal(dashboard.analytics.available,false);assert.equal(dashboard.analytics.metrics.totalVisitors,null);assert.equal(dashboard.overview.metrics.totalUsers,2);db.close();
});
const bootstrapIdentityFixture={issuer:'https://clerk.seekoffer.com.cn',subject:'user_newsynthetic'};
const bootstrapConfig={CLERK_ISSUER:bootstrapIdentityFixture.issuer,CLERK_BACKEND_SECRET:'sk_live_synthetic',NEW_ACCOUNTS_ENABLED:'true',NEW_ACCOUNTS_FROM:'2026-09-09T00:00:00Z'};
const bootstrapUser={id:bootstrapIdentityFixture.subject,external_id:null,banned:false,locked:false,created_at:Date.parse('2026-09-09T01:00:00Z'),primary_email_address_id:'email_test',email_addresses:[{id:'email_test',verification:{status:'verified'}}]};
test('new verified identity initialization is atomic and replay-safe, preserving subsequent profile edits',async()=>{
 const {db,env,queries}=setup();let calls=0;const fetcher=async(url,init)=>{calls++;assert.equal(url,'https://api.clerk.com/v1/users/user_newsynthetic');assert.equal(init.redirect,'manual');return Response.json(bootstrapUser);};
 const results=await Promise.all([bootstrapIdentity(env.CORE,bootstrapIdentityFixture,bootstrapConfig,fetcher),bootstrapIdentity(env.CORE,bootstrapIdentityFixture,bootstrapConfig,fetcher)]);
 assert.equal(results[0].userId,results[1].userId);const id=results[0].userId;assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 db.prepare('UPDATE main__profiles SET nickname=? WHERE id=?').run('User edit preserved',id);const before=calls;
 await bootstrapIdentity(env.CORE,bootstrapIdentityFixture,bootstrapConfig,fetcher);assert.equal(calls,before);assert.equal(db.prepare('SELECT nickname FROM main__profiles WHERE id=?').get(id).nickname,'User edit preserved');assert.equal(db.prepare('SELECT count(*) AS n FROM main__profiles').get().n,3);assert.equal(db.prepare('SELECT count(*) AS n FROM autofill__auth_subjects').get().n,0);assert.ok(!queries.some(q=>/DROP|DELETE|REPLACE/.test(q)));db.close();
});
test('unverified, banned, foreign external IDs and pre-cutover unmapped users cannot be provisioned',async()=>{
 const {db,env}=setup();for(const patch of [{banned:true},{locked:true},{external_id:'bqzchxacykhdmoczysfe:original-id'},{created_at:0},{email_addresses:[{id:'email_test',verification:{status:'unverified'}}]},{id:'user_wrong'}])await assert.rejects(()=>bootstrapIdentity(env.CORE,bootstrapIdentityFixture,bootstrapConfig,async()=>Response.json({...bootstrapUser,...patch})));
 assert.equal(db.prepare('SELECT count(*) AS n FROM main__auth_subjects').get().n,2);assert.equal(db.prepare('SELECT count(*) AS n FROM _identity_links').get().n,2);db.close();
});
test('email verification preserves a mapped original UUID and cannot override bans or another identity',async()=>{
 const {db,env}=setup();db.prepare('UPDATE _identity_links SET issuer=?,subject=? WHERE legacy_user_id=?').run(bootstrapIdentityFixture.issuer,bootstrapIdentityFixture.subject,ownerA);db.prepare('UPDATE main__auth_subjects SET email_confirmed_at=NULL WHERE id=?').run(ownerA);
 const config={...bootstrapConfig,NEW_ACCOUNTS_ENABLED:'false'};
 await assert.rejects(()=>bootstrapIdentity(env.CORE,bootstrapIdentityFixture,config,async()=>Response.json(bootstrapUser)));assert.equal(db.prepare('SELECT email_confirmed_at FROM main__auth_subjects WHERE id=?').get(ownerA).email_confirmed_at,null);
 const verified=async()=>Response.json({...bootstrapUser,external_id:'mnotoltpythkayguhnrk:'+ownerA});assert.equal((await bootstrapIdentity(env.CORE,bootstrapIdentityFixture,config,verified)).userId,ownerA);assert.equal(db.prepare('SELECT nickname FROM main__profiles WHERE id=?').get(ownerA).nickname,'Alice');
 db.prepare('UPDATE main__auth_subjects SET banned_until=? WHERE id=?').run('2099-01-01',ownerA);await assert.rejects(()=>bootstrapIdentity(env.CORE,bootstrapIdentityFixture,config,verified),/ACCOUNT_BLOCKED/);db.close();
});
test('bootstrap requires signed identity, an empty request body and enabled business writes',async()=>{
 const {db,env}=setup();let calls=0;const worker=createSnapshotWorker(async token=>{if(token!=='valid')throw new ApiError(401,'INVALID_IDENTITY');return bootstrapIdentityFixture;},async()=>{calls++;throw Error('must not fetch');});
 const req=(method='POST',token='valid',body={})=>worker.fetch(new Request('http://127.0.0.1/v1/me/bootstrap',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined}),env);
 assert.equal((await req('GET')).status,405);assert.equal((await req('POST','forged')).status,401);assert.equal((await req('POST','valid',{userId:ownerA})).status,400);env.BUSINESS_WRITES_ENABLED='false';assert.equal((await req()).status,503);assert.equal(calls,0);db.close();
});
test('a failed profile insert rolls back all new identity records',async()=>{
 const {db,env}=setup();db.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON main__profiles BEGIN SELECT RAISE(ABORT,'synthetic write failure'); END");
 await assert.rejects(()=>bootstrapIdentity(env.CORE,bootstrapIdentityFixture,bootstrapConfig,async()=>Response.json(bootstrapUser)));
 assert.equal(db.prepare('SELECT count(*) AS n FROM main__auth_subjects').get().n,2);assert.equal(db.prepare('SELECT count(*) AS n FROM _identity_links').get().n,2);db.close();
});
test('restored login flow completes against the actual candidate schema only after identity bootstrap and profile read',async()=>{
 const {db,env}=setup();Object.assign(env,bootstrapConfig);const paths=[];
 const worker=createSnapshotWorker(async token=>{assert.equal(token,'synthetic-token');return bootstrapIdentityFixture;},async()=>Response.json(bootstrapUser));
 const client=createD1BackendClient('http://127.0.0.1',async()=>'synthetic-token',async(input,init)=>{paths.push(new URL(input).pathname+':'+(init?.method||'GET'));return worker.fetch(new Request(input,init),env);});
 const sdk={session:null,user:null,client:{signIn:{create:async()=>({status:'complete',createdSessionId:'sess_synthetic'})}},setActive:async({session})=>{sdk.session={id:session};sdk.user={id:bootstrapIdentityFixture.subject,primaryEmailAddress:{emailAddress:'synthetic@example.invalid'}};}};
 const flow=createClerkAuthFlow(async()=>sdk,async()=>{assert.equal(sdk.session.id,'sess_synthetic');const profile=await readOrInitializeProfile(client,'synthetic-token');return{loggedIn:true,userId:profile.id,email:'synthetic@example.invalid',profile};});
 const result=await flow.password('synthetic@example.invalid','synthetic-password');assert.equal(result.status,'signed_in');assert.notEqual(result.session.userId,ownerA);assert.notEqual(result.session.userId,ownerB);assert.equal(db.prepare('SELECT count(*) AS n FROM main__profiles WHERE id=?').get(result.session.userId).n,1);
 assert.deepEqual(paths,['/v1/me/profile:GET','/v1/me/bootstrap:POST','/v1/me/profile:GET']);assert.equal(db.prepare('SELECT count(*) AS n FROM main__applications WHERE user_id=?').get(result.session.userId).n,0);db.close();
});
function adapt(db,queries){return {prepare(sql){let args=[];const execute=()=>{queries.push(sql);return {success:true,results:db.prepare(sql).all(...args)};};const q={bind(...values){args=values;return q;},execute,async first(){queries.push(sql);return db.prepare(sql).get(...args)||null;},async all(){return execute();},async run(){queries.push(sql);const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:r.changes}};}};return q;},async batch(statements){db.exec('BEGIN');try{const results=statements.map(s=>s.execute());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}};}
function sample(i){return {id:'notice-'+String(i).padStart(3,'0'),school_name:i%2?'北京大学':'清华大学',department_name:i%3?'计算机学院':'经济管理学院',project_name:i%4?'2026年预推免招生申请通知':'2026年研究生招生宣讲会',project_type:i%5?'预推免':'夏令营',discipline:i%3?'计算机科学':'金融学',publish_date:'2026-09-'+String(i%9+1).padStart(2,'0'),deadline_date:i%6?'2026-09-'+String(i%10+8).padStart(2,'0'):'',status:i%7?'报名中':'未开始',tags:JSON.stringify(['北京','985']),source_link:'https://example.edu.cn/notice/'+i,year:2026,is_private:0,admin_status:'published',created_by:ownerA,admin_review_note:'PRIVATE_ADMIN_NOTE'};}
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;'+base);
 for(const id of [ownerA,ownerB]){db.prepare('INSERT INTO main__auth_subjects(id,email_confirmed_at) VALUES(?,?)').run(id,'2026-09-01');db.prepare('INSERT INTO main__profiles(id,nickname) VALUES(?,?)').run(id,id===ownerA?'Alice':'Bob');}
 db.exec(runtime);db.prepare('INSERT INTO _runtime_state VALUES (?,?)').run('notice_version','fixture-v1');
 for(const [subject,id]of [['a',ownerA],['b',ownerB]])db.prepare('INSERT INTO _identity_links VALUES(?,?,?,?)').run('https://clerk.example.invalid',subject,'mnotoltpythkayguhnrk',id);
 const rows=Array.from({length:48},(_,i)=>sample(i));rows.sort((a,b)=>b.publish_date.localeCompare(a.publish_date)||a.id.localeCompare(b.id));
 for(const [rank,row]of rows.entries()){
  const cols=Object.keys(row);db.prepare('INSERT INTO main__notices('+cols.join(',')+') VALUES('+cols.map(()=>'?').join(',')+')').run(...Object.values(row));
  const p=createNoticeProjection({...row,tags:JSON.parse(row.tags)},rank,row.school_name==='北京大学'?0:1);
  db.prepare('UPDATE main__notices SET catalog_projection=? WHERE id=?').run(p?JSON.stringify(p):null,row.id);
 }
 const queries=[];const env={CORE:adapt(db,queries),MODE:'local',ALLOWED_ORIGINS:'http://127.0.0.1:3000',BUSINESS_WRITES_ENABLED:'true'};
 const worker=createSnapshotWorker(async token=>({issuer:'https://clerk.example.invalid',subject:token}));
 const request=(path,method='GET',body,subject='a')=>worker.fetch(new Request('http://127.0.0.1'+path,{method,headers:{Authorization:'Bearer '+subject,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env);
 return {db,rows,queries,env,worker,request};
}
test('real candidate schema: SQL filters match the existing fixed-sample implementation',()=>{
 const {db,rows}=setup();const now=new Date();
 const fields={keyword:'',schoolName:'',region:'全部',majorKeyword:'',category:'全部',discipline:'全部',schoolRange:'全部',progress:'全部',deadlineQuick:'全部',fresh:'全部',publishDate:'',projectType:'全部',noticeKind:'全部',year:'2026',sortBy:'publish'};
 const projects=filterMainNoticeProjects(rows.map(r=>mapNoticeRowToProject({...r,tags:JSON.parse(r.tags)})));
 const variants=[{},...['publish','deadline','school','updated'].map(sortBy=>({sortBy})),{keyword:'计算机'},{keyword:'学'},{keyword:'2026'},{schoolName:'北京'},{region:'北京'},{region:'不存在'},{majorKeyword:'金融'},{category:'工学'},{discipline:'计算机科学'},{schoolRange:'211'},{schoolRange:'985'},{projectType:'夏令营'},{noticeKind:'宣讲会'},...['报名中','未开始','已结束'].map(progress=>({progress})),...['today','within3days','within7days'].map(deadlineQuick=>({deadlineQuick})),{fresh:'today'},{publishDate:'2026-09-08'}];
 const mapping={keyword:'q',schoolName:'school',region:'region',majorKeyword:'major',category:'category',discipline:'discipline',schoolRange:'range',progress:'status',deadlineQuick:'deadline',fresh:'fresh',publishDate:'date',projectType:'type',noticeKind:'kind',year:'year',sortBy:'sort'};
 for(const v of variants){const filter={...fields,...v};const params=new URLSearchParams();for(const [key,value]of Object.entries(filter))if(value)params.set(mapping[key],value);const q=noticeSql(params,now.getTime());const actual=db.prepare('SELECT n.id FROM main__notices n WHERE '+q.where+' ORDER BY '+q.order).all(...q.values).map(r=>r.id);const expected=filterAndSortNotices(projects,filter,now).map(r=>r.id);assert.deepEqual(actual,expected,JSON.stringify(v));}db.close();
});
test('16-item list uses a persistent count cache, returns no internal fields, hides revoked rows',async()=>{
 const {db,request,queries}=setup();const first=await request('/v1/notices?page=2');assert.equal(first.status,200);const text=await first.text();assert.ok(Buffer.byteLength(text)<100000);const body=JSON.parse(text);assert.equal(body.items.length,16);assert.ok(!text.includes('PRIVATE_ADMIN_NOTE'));assert.ok(!text.includes('created_by'));
 const scans=queries.filter(q=>q.startsWith('SELECT count(*) AS total FROM main__notices')).length;
 const warm=await request('/v1/notices?page=2');assert.equal(warm.headers.get('X-Count-Cache'),'HIT');assert.equal(queries.filter(q=>q.startsWith('SELECT count(*) AS total FROM main__notices')).length,scans);
 const id=body.items[0].id;db.prepare("UPDATE main__notices SET admin_status='hidden' WHERE id=?").run(id);assert.equal((await request('/v1/notices/'+id)).status,404);
 const batch=await (await request('/v1/notices/by-ids','POST',{ids:[id]})).json();assert.equal(batch.items.length,0);db.close();
});
test('both detail routes query only their ID, not the complete notice catalog',async()=>{
 const {db,request,queries}=setup();assert.equal((await request('/v1/notices/notice-001')).status,200);assert.equal((await request('/v1/notices/detail?id=notice-001')).status,200);assert.ok(queries.every(q=>q.includes('WHERE n.id=?')));db.close();
});
test('unknown filters, overlarge pages, anonymous identity and preview access fail closed',async()=>{
 const {db,request,worker,env}=setup();assert.equal((await request('/v1/notices?pageSize=41')).status,400);assert.equal((await request('/v1/notices?sort=random')).status,400);assert.equal((await request('/v1/notices?refresh=all')).status,400);
 assert.equal((await worker.fetch(new Request('http://127.0.0.1/v1/me/profile'),env)).status,401);env.MODE='preview';assert.equal((await request('/health')).status,503);env.PREVIEW_ACCESS_TOKEN='synthetic-preview-guard-1234567890';assert.equal((await request('/health')).status,401);db.close();
});
test('private profile revisions cannot overwrite another owner or silently accept stale data',async()=>{
 const {db,request}=setup();assert.equal((await request('/v1/me/profile','PUT',{expectedRevision:1,patch:{nickname:'updated',id:ownerB}})).status,400);
 assert.equal((await request('/v1/me/profile','PUT',{expectedRevision:1,patch:{nickname:'updated'}})).status,200);
 assert.equal((await request('/v1/me/profile','PUT',{expectedRevision:1,patch:{nickname:'stale'}})).status,409);
 assert.equal(db.prepare('SELECT nickname FROM main__profiles WHERE id=?').get(ownerB).nickname,'Bob');db.close();
});
test('source free quota remains atomic under concurrent new applications; retries preserve the UUID',async()=>{
 const {db,request}=setup();const results=await Promise.all(Array.from({length:10},(_,i)=>request('/v1/me/applications','POST',{projectId:'notice-'+String(i).padStart(3,'0')})));
 assert.equal(db.prepare('SELECT count(*) AS n FROM main__applications WHERE user_id=?').get(ownerA).n,5);assert.equal(results.filter(r=>r.status===403).length,5);
 const old=db.prepare('SELECT id,project_id FROM main__applications WHERE user_id=? LIMIT 1').get(ownerA);const retry=await(await request('/v1/me/applications','POST',{projectId:old.project_id})).json();assert.equal(retry.id,old.id);
 assert.equal((await request('/v1/me/applications/'+old.id,'PUT',{expectedRevision:1,patch:{my_notes:'intrusion'}},'b')).status,409);
 db.prepare('DELETE FROM main__notices WHERE id=?').run(old.project_id);const rows=await(await request('/v1/me/applications')).json();assert.ok(rows.items.some(r=>r.id===old.id));db.close();
});
test('unverified and banned accounts are rejected, and preview read-only never returns save success',async()=>{
 const {db,request,env}=setup();db.prepare('UPDATE main__auth_subjects SET email_confirmed_at=NULL WHERE id=?').run(ownerA);assert.equal((await request('/v1/me/profile')).status,403);db.prepare('UPDATE main__auth_subjects SET email_confirmed_at=?,banned_until=? WHERE id=?').run('2026-09-01','2099-01-01',ownerA);assert.equal((await request('/v1/me/profile')).status,403);db.prepare('UPDATE main__auth_subjects SET banned_until=NULL WHERE id=?').run(ownerA);env.BUSINESS_WRITES_ENABLED='false';assert.equal((await request('/v1/me/profile','PUT',{expectedRevision:1,patch:{nickname:'not saved'}})).status,503);assert.equal(db.prepare('SELECT nickname FROM main__profiles WHERE id=?').get(ownerA).nickname,'Alice');db.close();
});
test('opaque AES-GCM vault survives storage with original UUID AAD; other owners cannot read it',async()=>{
 const {db,request}=setup();const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const plain=new TextEncoder().encode('synthetic private profile');const aad=new TextEncoder().encode(ownerA);const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,plain);
 const payload={algorithm:'AES-GCM-256',ciphertext:Buffer.from(encrypted).toString('base64'),iv:Buffer.from(iv).toString('base64')},rev=crypto.randomUUID();
 const body={expectedRevision:null,revision:rev,encryptedPayload:payload,schemaVersion:1};assert.equal((await request('/v1/me/vault','PUT',body)).status,201);assert.equal((await request('/v1/me/vault','PUT',body)).status,409);
 const loaded=await(await request('/v1/me/vault')).json();assert.deepEqual(loaded.encrypted_payload,payload);const restored=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},key,Buffer.from(loaded.encrypted_payload.ciphertext,'base64'));assert.equal(new TextDecoder().decode(restored),'synthetic private profile');
 await assert.rejects(()=>crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('new-clerk-subject')},key,encrypted));assert.equal(await(await request('/v1/me/vault','GET',undefined,'b')).json(),null);
 assert.equal((await request('/v1/me/vault','PUT',{...body,expectedRevision:crypto.randomUUID(),revision:crypto.randomUUID()})).status,409);assert.equal(db.prepare('SELECT revision FROM main__user_vaults WHERE user_id=?').get(ownerA).revision,rev);db.close();
});
test('initial workbench creation is explicit, retries cannot replace saved todos',async()=>{
 const {db,request}=setup();const body={expectedRevision:0,completed_todo_ids:[],custom_todos:[{id:'synthetic-todo',title:'Keep local notes'}],mentor_contacts:[]};assert.equal((await request('/v1/me/workbench','PUT',body)).status,201);assert.equal((await request('/v1/me/workbench','PUT',{...body,custom_todos:[]})).status,409);const result=await(await request('/v1/me/workbench')).json();assert.equal(result.custom_todos.length,1);db.close();
});
test('linked notice reads retain missing applications and isolate private manual notices in read-only mode',async()=>{
 const {db,request,env,queries}=setup();
 db.prepare('UPDATE main__notices SET is_private=1 WHERE id=?').run('notice-001');
 db.prepare('UPDATE main__notices SET is_private=1,created_by=? WHERE id=?').run(ownerB,'notice-002');
 db.prepare("UPDATE main__notices SET admin_status='hidden' WHERE id=?").run('notice-003');
 for(const n of ['001','002','003','004'])db.prepare('INSERT INTO main__applications(id,user_id,project_id,my_notes) VALUES(?,?,?,?)').run('app-'+n,ownerA,'notice-'+n,'keep this note');
 env.BUSINESS_WRITES_ENABLED='false';
 const r=await request('/v1/me/notices/by-ids','POST',{ids:['notice-001','notice-001','notice-002','notice-003','notice-005']});assert.equal(r.status,200);
 const text=await r.text(),data=JSON.parse(text);assert.deepEqual(data.items.map(x=>x.id),['notice-001']);assert.deepEqual(data.unavailableIds,['notice-002','notice-003','notice-005']);assert.ok(!text.includes('PRIVATE_ADMIN_NOTE'));assert.ok(!text.includes('created_by'));
 const before=queries.length;assert.equal((await request('/v1/me/notices/by-ids','POST',{ids:[]})).status,200);assert.equal(queries.slice(before).filter(q=>q.includes('main__notices')).length,0);
 assert.equal((await request('/v1/me/notices/by-ids','POST',{ids:Array(100).fill('notice-001')})).status,400);
 const other=await(await request('/v1/me/notices/by-ids','POST',{ids:['notice-001']},'b')).json();assert.equal(other.items.length,0);
 db.prepare('DELETE FROM main__notices WHERE id=?').run('notice-004');const applications=await(await request('/v1/me/applications')).json();assert.equal(applications.items.length,4);assert.equal(applications.items.find(x=>x.id==='app-004').my_notes,'keep this note');db.close();
});
test('browser acceptance requires the production origin and verified mapped identity, writes one diagnostic only',async()=>{
 const {db,env,queries}=setup();Object.assign(env,{MODE:'preview',BUSINESS_WRITES_ENABLED:'false',CLERK_ISSUER:'https://clerk.seekoffer.com.cn',CLERK_AUDIENCE:'seekoffer',AUTHORIZED_PARTIES:'https://migration.seekoffer.com.cn',ALLOWED_ORIGINS:'https://migration.seekoffer.com.cn',PREVIEW_ACCESS_TOKEN:'synthetic-preview-secret-never-in-browser'});
 db.prepare('UPDATE _identity_links SET issuer=?').run(env.CLERK_ISSUER);
 const app=createAcceptanceWorker(async token=>{if(token!=='synthetic-valid')throw new ApiError(401,'INVALID_IDENTITY');return {issuer:env.CLERK_ISSUER,subject:'a'};});
 const request=(path='/acceptance/api/verify',headers={Authorization:'Bearer synthetic-valid'},method='GET')=>app.fetch(new Request('https://migration.seekoffer.com.cn'+path,{headers,method}),env);
 let before=queries.length;assert.equal((await request('/acceptance/api/verify',{})).status,401);assert.equal(queries.length,before);
 assert.equal((await request('/acceptance/api/verify',{Authorization:'Bearer forged'})).status,401);assert.equal(queries.length,before);
 assert.equal((await request('/acceptance/api/verify',{Authorization:'Bearer synthetic-valid',Origin:'https://evil.example'})).status,403);
 assert.equal((await request('/acceptance/api/verify',{},'POST')).status,405);
 assert.equal((await app.fetch(new Request('https://example.workers.dev/acceptance'),env)).status,404);
 const html=await request('/acceptance');const markup=await html.text();assert.ok(!markup.includes(env.PREVIEW_ACCESS_TOKEN));assert.ok(!markup.includes(ownerA));assert.ok(html.headers.get('content-security-policy').includes("connect-src 'self' https://clerk.seekoffer.com.cn"));assert.ok(!markup.includes('supabase'));
 for(const script of markup.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Script(script[1]));
 const verified=await request();assert.equal(verified.status,200);const proof=await verified.json();assert.equal(proof.originalUUIDMappingVerified,true);assert.equal(proof.businessWrites,0);assert.equal(proof.checks.length,3);
 assert.equal(db.prepare("SELECT count(*) AS n FROM _runtime_state WHERE key='controlled_browser_acceptance_v1'").get().n,1);
 before=queries.length;assert.equal((await request()).status,200);assert.ok(!queries.slice(before).some(q=>q.startsWith('INSERT')));
 assert.equal(db.prepare('SELECT nickname FROM main__profiles WHERE id=?').get(ownerA).nickname,'Alice');assert.equal(db.prepare('SELECT count(*) AS n FROM main__applications').get().n,0);
 db.prepare('DELETE FROM _identity_links WHERE subject=?').run('a');assert.equal((await request()).status,403);db.close();
});
const manualInput={schoolName:'测试大学',departmentName:'测试学院',projectName:'合成测试私有项目',projectType:'预推免',discipline:'计算机',deadlineDate:'',applyLink:'https://example.invalid/application'};
test('manual project and application are atomic, replay-safe, owner-isolated and never published',async()=>{
 const {db,request}=setup(),body={requestId:crypto.randomUUID(),project:manualInput};
 const results=await Promise.all([request('/v1/me/manual-projects','POST',body),request('/v1/me/manual-projects','POST',body)]);for(const r of results)assert.equal(r.status,201);const first=await results[0].json(),second=await results[1].json();assert.equal(first.projectId,second.projectId);assert.equal(first.application.id,second.application.id);
 assert.equal(db.prepare('SELECT count(*) AS n FROM main__applications').get().n,1);const notice=db.prepare('SELECT is_private,created_by,deadline_date,catalog_projection FROM main__notices WHERE id=?').get(first.projectId);assert.equal(notice.is_private,1);assert.equal(notice.created_by,ownerA);assert.equal(notice.deadline_date,'');assert.equal(notice.catalog_projection,null);
 assert.equal((await request('/v1/notices/'+first.projectId)).status,404);assert.equal((await request('/v1/me/manual-projects','POST',{...body,project:{...manualInput,projectName:'conflicting content'}})).status,409);
 const other=await(await request('/v1/me/manual-projects','POST',body,'b')).json();assert.notEqual(other.projectId,first.projectId);
 db.prepare('DELETE FROM main__applications WHERE id=?').run(first.application.id);assert.equal((await request('/v1/me/manual-projects','POST',body)).status,409);db.close();
});
test('manual quota failure rolls back the notice; unsafe links and invalid dates never write',async()=>{
 const {db,request,env}=setup();
 for(let i=0;i<5;i++)await request('/v1/me/applications','POST',{projectId:'notice-'+String(i).padStart(3,'0')});
 const before=db.prepare('SELECT count(*) AS n FROM main__notices').get().n,body={requestId:crypto.randomUUID(),project:manualInput};
 assert.equal((await request('/v1/me/manual-projects','POST',body)).status,403);assert.equal(db.prepare('SELECT count(*) AS n FROM main__notices').get().n,before);
 for(const patch of [{applyLink:'javascript:alert(1)'},{deadlineDate:'2026-02-30'},{created_by:ownerB}])assert.equal((await request('/v1/me/manual-projects','POST',{...body,project:{...manualInput,...patch}})).status,400);
 env.BUSINESS_WRITES_ENABLED='false';assert.equal((await request('/v1/me/manual-projects','POST',body)).status,503);assert.equal(db.prepare('SELECT count(*) AS n FROM main__notices').get().n,before);db.close();
});
test('signed preview browser can read only its private scope without receiving the preview secret',async()=>{
 const {db,worker,env}=setup();Object.assign(env,{MODE:'preview',BUSINESS_WRITES_ENABLED:'false',ALLOWED_ORIGINS:'https://migration.seekoffer.com.cn',PREVIEW_ACCESS_TOKEN:'synthetic-server-only-preview-secret'});
 const get=(path,token='a')=>worker.fetch(new Request('https://migration.seekoffer.com.cn'+path,{headers:{Authorization:'Bearer '+token,Origin:'https://migration.seekoffer.com.cn'}}),env);
 const response=await get('/v1/me/profile');assert.equal(response.status,200);assert.equal((await response.json()).id,ownerA);assert.equal((await get('/v1/me/profile','unmapped')).status,403);assert.equal((await get('/v1/notices')).status,401);
 assert.equal((await worker.fetch(new Request('https://example.workers.dev/v1/me/profile',{headers:{Authorization:'Bearer a'}}),env)).status,401);
 const save=await worker.fetch(new Request('https://migration.seekoffer.com.cn/v1/me/profile',{method:'PUT',headers:{Authorization:'Bearer a','Content-Type':'application/json'},body:JSON.stringify({expectedRevision:1,patch:{nickname:'blocked'}})}),env);assert.equal(save.status,503);db.close();
});


test('application client and persistent journal exercise actual candidate SQL without legacy upstream',async()=>{
 const {db,worker,env}=setup(),state=new Map();
 const storage={getItem:key=>state.get(key)||null,setItem:(key,value)=>state.set(key,value)};
 const fetcher=(input,init)=>worker.fetch(new Request(input,init),env);
 const client=Object.assign(createD1BackendClient('http://127.0.0.1',async()=>'a',fetcher),{sessionScope:'a'});
 const workspace=createApplicationWorkspace(ownerA,storage,async()=>client,()=>true);
 assert.deepEqual(await workspace.read(),[]);
 const added=await workspace.add('notice-001');assert.equal(added.project_id,'notice-001');assert.equal(added.sync_revision,1);
 await workspace.update(added.id,{my_notes:'original UUID test note',cv_ready:true});
 assert.equal(db.prepare('SELECT user_id,my_notes FROM main__applications WHERE id=?').get(added.id).user_id,ownerA);
 assert.equal((await workspace.read())[0].my_notes,'original UUID test note');
 const detail=await client.applicationNotices(['notice-001']);assert.equal(detail.items.length,1);assert.equal('admin_review_note' in detail.items[0],false);
 env.BUSINESS_WRITES_ENABLED='false';await assert.rejects(workspace.update(added.id,{my_notes:'offline draft'}),error=>error.status===503);
 assert.equal(workspace.cached()[0].my_notes,'offline draft');assert.equal(db.prepare('SELECT my_notes FROM main__applications WHERE id=?').get(added.id).my_notes,'original UUID test note');
 env.BUSINESS_WRITES_ENABLED='true';await workspace.update(added.id,{my_notes:'offline draft'});assert.deepEqual(workspace.pending().updates,[]);
 const manual=await workspace.manual({schoolName:'Synthetic School',departmentName:'Test',projectName:'Private application',projectType:'夏令营',discipline:'Engineering',deadlineDate:''});
 assert.equal(manual.project.id,manual.projectId);assert.equal(manual.project.deadlineDate,'');
 const otherClient=createD1BackendClient('http://127.0.0.1',async()=>'b',fetcher);
 assert.deepEqual(await otherClient.applications(),[]);assert.deepEqual((await otherClient.applicationNotices([manual.projectId])).items,[]);
 assert.equal(await workspace.remove(added.id),true);assert.equal(db.prepare('SELECT count(*) AS n FROM main__applications WHERE id=?').get(added.id).n,0);
 db.close();
});


test('website recovery enables only authenticated owner writes, closes public D1 reads and payments',async()=>{
 const {db,worker,env}=setup();Object.assign(env,{MODE:'production',BUSINESS_WRITES_ENABLED:'true',PUBLIC_READ_ENABLED:'false',PAYMENT_PROCESSING_ENABLED:'false',ALLOWED_ORIGINS:'https://www.seekoffer.com.cn,https://migration.seekoffer.com.cn'});
 const call=(path,method='GET',body,token='a',origin='https://www.seekoffer.com.cn')=>worker.fetch(new Request('https://migration.seekoffer.com.cn'+path,{method,headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),env);
 assert.equal((await call('/v1/notices')).status,503);assert.equal((await call('/v1/me/profile','GET',undefined,'')).status,401);
 assert.equal((await call('/v1/me/profile','GET',undefined,'a','https://unrelated.example')).status,403);
 assert.equal((await call('/v1/me/profile','PUT',{expectedRevision:1,patch:{nickname:'Synthetic recovery'}})).status,200);
 assert.equal(db.prepare('SELECT nickname FROM main__profiles WHERE id=?').get(ownerA).nickname,'Synthetic recovery');assert.equal(db.prepare('SELECT nickname FROM main__profiles WHERE id=?').get(ownerB).nickname,'Bob');
 assert.equal((await call('/v1/payments/jianpay/notify','POST',{})).status,503);db.close();
});
