import {type D1Application, type createD1BackendClient, D1RequestError} from './d1-backend-client';

type Client=ReturnType<typeof createD1BackendClient>&{sessionScope?:string};
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'>;
type Row=D1Application&{sync_revision:number};
type Draft={expectedRevision:number;patch:Record<string,unknown>};
type State={version:1;rows:Row[];drafts:Record<string,Draft>;deletes:Record<string,number>;adds:string[];manuals:Record<string,string>};
const booleans=['is_favorited','cv_ready','transcript_ready','ranking_proof_ready','recommendation_ready','personal_statement_ready','contact_supervisor_done','custom_reminder_enabled'];
const texts=['my_status','priority_level','submitted_at','interview_time','result_status','my_notes'];
const allowed=new Set([...booleans,...texts,'materials_progress']);
const flights=new Map<string,Promise<Row[]>>();
const mutations=new Set<string>();
export const applicationJournalKey=(owner:string)=>'seekoffer-d1-applications-v1:'+owner;
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
function checkedRows(value:unknown):Row[]{
 if(!Array.isArray(value))throw new D1RequestError(502);
 const ids=new Set<string>(),projects=new Set<string>();
 for(const row of value){
  if(!row||typeof row!=='object'||typeof row.id!=='string'||!row.id||ids.has(row.id)||!(row.project_id===null||typeof row.project_id==='string')||!Number.isSafeInteger(row.sync_revision)||row.sync_revision<1||booleans.some(k=>typeof row[k]!=='boolean')||texts.some(k=>typeof row[k]!=='string')||!Number.isInteger(row.materials_progress)||row.materials_progress<0||row.materials_progress>100)throw new D1RequestError(502);
  if(row.project_id&&projects.has(row.project_id))throw new D1RequestError(502);
  ids.add(row.id);if(row.project_id)projects.add(row.project_id);
 }
 return value as Row[];
}
function checkedPatch(patch:Record<string,unknown>){
 if(!Object.keys(patch).length||Object.keys(patch).some(k=>!allowed.has(k)))throw new Error('申请修改包含不支持的字段。');
 for(const [k,v] of Object.entries(patch)){
  if(booleans.includes(k)?typeof v!=='boolean':k==='materials_progress'?(!Number.isInteger(v)||Number(v)<0||Number(v)>100):typeof v!=='string'||v.length>(k==='my_notes'?20000:500))throw new Error('申请修改格式无效，本地原记录未变。');
 }
 return copy(patch);
}
function ack(value:unknown,id?:string,after=0):{id:string;sync_revision:number}{
 const v=value as {id:string;sync_revision:number};
 if(!v||typeof v.id!=='string'||!v.id||(id&&v.id!==id)||!Number.isSafeInteger(v.sync_revision)||v.sync_revision<=after)throw new D1RequestError(502);
 return v;
}
export function createApplicationWorkspace(owner:string,storage:Storage,getClient:()=>Promise<Client>,isCurrent:()=>boolean){
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(owner))throw new Error('原账号关联无效。');
 const key=applicationJournalKey(owner);
 const assertCurrent=()=>{if(!isCurrent())throw new Error('账号已切换，请重新读取当前工作区。');};
 function load():State{
  const raw=storage.getItem(key);if(!raw)return {version:1,rows:[],drafts:{},deletes:{},adds:[],manuals:{}};
  const s=JSON.parse(raw) as State;
  if(s.version!==1||!s.drafts||!s.deletes||!Array.isArray(s.adds)||!s.manuals)throw new Error('本地申请检查点无法读取，请保留数据。');
  checkedRows(s.rows);return s;
 }
 function save(s:State){assertCurrent();storage.setItem(key,JSON.stringify(s));}
 function display(s:State){return s.rows.map(row=>({...row,...s.drafts[row.id]?.patch}));}
 async function exclusive<T>(work:()=>Promise<T>):Promise<T>{
  const run=async()=>{if(mutations.has(key))throw new Error('申请正在保存，请稍后重试。');mutations.add(key);try{return await work();}finally{mutations.delete(key);}};
  if(typeof navigator!=='undefined'&&navigator.locks)return navigator.locks.request(key,{mode:'exclusive'},run);
  return run();
 }
 async function read():Promise<Row[]>{
  assertCurrent();const client=await getClient(),scope=key+':'+(client.sessionScope||'');assertCurrent();
  const baseline=storage.getItem(key);let flight=flights.get(scope);
  if(!flight){flight=client.applications().then(checkedRows);flights.set(scope,flight);}
  let rows:Row[];try{rows=await flight;}finally{if(flights.get(scope)===flight)flights.delete(scope);}
  assertCurrent();
  return exclusive(async()=>{const s=load();
   if(storage.getItem(key)!==baseline)return display(s);
   if(rows.length===0&&s.rows.length>0)throw new Error('云端申请返回空结果，本地记录已保留，请核对后重试。');
   // Missing remote rows with unsynced edits stay local, never auto-created remotely.
   const found=new Set(rows.map(r=>r.id));
   s.rows=[...rows,...s.rows.filter(r=>!found.has(r.id)&&(s.drafts[r.id]||s.deletes[r.id]))];save(s);return display(s);
  });
 }
 async function confirmAdded(client:Client,projectId:string,result:unknown){
  const receipt=ack(result),rows=checkedRows(await client.applications());assertCurrent();
  const row=rows.find(r=>r.id===receipt.id&&r.project_id===projectId);if(!row)throw new D1RequestError(502);
  const s=load(),prior=new Map(s.rows.map(r=>[r.id,r]));for(const r of rows)prior.set(r.id,r);s.rows=[...prior.values()];s.adds=s.adds.filter(id=>id!==projectId);save(s);return {...row,...s.drafts[row.id]?.patch};
 }
 // Only the explicit Sync action calls this. Reads, timers and visibility events
 // never replay user writes. Each operation is checked against its original CAS.
 async function resumePending(limit=20){return exclusive(async()=>{
  if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new Error('单次同步数量必须在1到50之间。');
  assertCurrent();const s=load();let checkpoint=storage.getItem(key),completed=0;
  const count=()=>Object.keys(s.deletes).length+Object.keys(s.drafts).filter(id=>!Object.hasOwn(s.deletes,id)).length+new Set(s.adds).size+Object.keys(s.manuals).length;
  if(!count())return{completed,remaining:0};
  const unchanged=()=>{assertCurrent();if(storage.getItem(key)!==checkpoint)throw new Error('本机申请在同步期间发生变化，请保留内容后重试。');};
  const persist=()=>{unchanged();save(s);checkpoint=storage.getItem(key);completed++;};
  const client=await getClient();unchanged();
  const currentRow=async(id:string,allowMissing=false)=>{
   unchanged();
   try{const row=checkedRows([await client.application(id)])[0];unchanged();if(row.id!==id)throw new D1RequestError(502);return row;}
   catch(error){unchanged();if(allowMissing&&error instanceof D1RequestError&&error.status===404&&error.code==='APPLICATION_NOT_FOUND')return null;throw error;}
  };
  const acceptRow=(row:Row)=>{const index=s.rows.findIndex(r=>r.id===row.id);if(index<0)s.rows.push(row);else s.rows[index]=row;};
  const addedRow=async(projectId:string,result:unknown)=>{const receipt=ack(result),row=await currentRow(receipt.id);if(!row||row.project_id!==projectId||row.sync_revision<receipt.sync_revision)throw new D1RequestError(502);return row;};
  for(const [id,expected] of Object.entries(s.deletes)){
   if(completed>=limit)break;unchanged();
   if(!Number.isSafeInteger(expected)||expected<1||!s.rows.some(r=>r.id===id))throw new Error('待同步删除记录需要核对，原记录已保留。');
   const row=await currentRow(id,true);
   if(row){if(row.sync_revision!==expected)throw new D1RequestError(409,'REVISION_CONFLICT');const result=await client.deleteApplication(id,expected) as {deleted:boolean;id:string};unchanged();if(result?.deleted!==true||result.id!==id)throw new D1RequestError(502);}
   // Only an explicit, owner-scoped 404 can resolve a lost delete response.
   // An empty collection or a generic 404 never clears the local record.
   s.rows=s.rows.filter(r=>r.id!==id);delete s.deletes[id];delete s.drafts[id];persist();
  }
  for(const [id,draft] of Object.entries(s.drafts)){
   if(completed>=limit)break;if(Object.hasOwn(s.deletes,id))continue;unchanged();
   if(!Number.isSafeInteger(draft.expectedRevision)||draft.expectedRevision<1||!s.rows.some(r=>r.id===id))throw new Error('待同步修改的原版本无效，原内容已保留。');
   const patch=checkedPatch(draft.patch),row=await currentRow(id);
   if(!row||row.sync_revision<draft.expectedRevision)throw new D1RequestError(409,'REVISION_CONFLICT');
   if(!Object.entries(patch).every(([k,v])=>row[k]===v)){
    if(row.sync_revision!==draft.expectedRevision)throw new D1RequestError(409,'REVISION_CONFLICT');
    const result=ack(await client.updateApplication(id,draft.expectedRevision,patch),id,draft.expectedRevision);unchanged();acceptRow({...row,...patch,sync_revision:result.sync_revision});
   }else acceptRow(row); // Previous request may have committed before its response was lost.
   delete s.drafts[id];persist();
  }
  for(const projectId of [...new Set(s.adds)]){
   if(completed>=limit)break;unchanged();if(typeof projectId!=='string'||!projectId||projectId.length>180)throw new Error('待同步通知编号无效，原内容已保留。');
   const row=await addedRow(projectId,await client.addApplication(projectId));unchanged();acceptRow(row);s.adds=s.adds.filter(id=>id!==projectId);persist();
  }
  for(const [requestKey,requestId] of Object.entries(s.manuals)){
   if(completed>=limit)break;unchanged();const project=JSON.parse(requestKey);
   if(!project||typeof project!=='object'||Array.isArray(project)||typeof requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(requestId))throw new Error('手动项目检查点无效，原内容已保留。');
   const result=await client.createManualProject(requestId,project) as {projectId:string;application:unknown};unchanged();
   if(!result||typeof result.projectId!=='string'||!result.projectId.startsWith('custom-'))throw new D1RequestError(502);
   const row=await addedRow(result.projectId,result.application),details=await client.applicationNotices([result.projectId]);unchanged();
   if(!details.items.some(p=>p.id===result.projectId))throw new Error('手动项目关联暂不可读取，原检查点已保留。');
   acceptRow(row);delete s.manuals[requestKey];persist();
  }
  return{completed,remaining:count()};
 });}
 return {
  read,
  resumePending,
  cached:()=>{assertCurrent();return display(load());},
  pending:()=>{assertCurrent();const s=load();return {updates:Object.keys(s.drafts),deletes:Object.keys(s.deletes),adds:[...s.adds],manualCount:Object.keys(s.manuals).length};},
  async update(id:string,patch:Record<string,unknown>){return exclusive(async()=>{
   assertCurrent();const s=load(),row=s.rows.find(r=>r.id===id);if(!row)throw new Error('请先读取原申请，修改未发送。');
   const draft={expectedRevision:s.drafts[id]?.expectedRevision??row.sync_revision,patch:{...s.drafts[id]?.patch,...checkedPatch(patch)}};s.drafts[id]=draft;save(s);
   const client=await getClient(),result=ack(await client.updateApplication(id,draft.expectedRevision,draft.patch),id,draft.expectedRevision);assertCurrent();
   const current=load(),index=current.rows.findIndex(r=>r.id===id);if(index<0)throw new Error('本地申请发生变化，待同步修改已保留。');
   current.rows[index]={...current.rows[index],...draft.patch,sync_revision:result.sync_revision};delete current.drafts[id];save(current);return current.rows[index];
  });},
  async add(projectId:string){return exclusive(async()=>{
   assertCurrent();if(!projectId||projectId.length>180)throw new Error('通知编号无效。');
   const s=load(),existing=s.rows.find(r=>r.project_id===projectId);if(existing)return {...existing,...s.drafts[existing.id]?.patch};
   if(!s.adds.includes(projectId))s.adds.push(projectId);save(s);
   const client=await getClient();return confirmAdded(client,projectId,await client.addApplication(projectId));
  });},
  async remove(id:string){return exclusive(async()=>{
   assertCurrent();const s=load(),row=s.rows.find(r=>r.id===id);if(!row)return false;
   const revision=s.deletes[id]??row.sync_revision;s.deletes[id]=revision;save(s);
   const client=await getClient(),result=await client.deleteApplication(id,revision) as {deleted:boolean;id:string};assertCurrent();
   if(!result||result.deleted!==true||result.id!==id)throw new D1RequestError(502);
   const current=load();current.rows=current.rows.filter(r=>r.id!==id);delete current.drafts[id];delete current.deletes[id];save(current);return true;
  });},
  async manual(project:Record<string,unknown>){return exclusive(async()=>{
   assertCurrent();const requestKey=JSON.stringify(project),s=load();const requestId=s.manuals[requestKey]||crypto.randomUUID();s.manuals[requestKey]=requestId;save(s);
   const client=await getClient(),result=await client.createManualProject(requestId,project) as {projectId:string;application:unknown};assertCurrent();
   if(!result||typeof result.projectId!=='string'||!result.projectId.startsWith('custom-'))throw new D1RequestError(502);
   const row=await confirmAdded(client,result.projectId,result.application);
   const details=await client.applicationNotices([result.projectId]);assertCurrent();
   const projectRow=details.items.find(p=>p.id===result.projectId);if(!projectRow)throw new Error('项目已保存，关联通知暂不可读取；再次提交会核对原项目。');
   const current=load();delete current.manuals[requestKey];save(current);return {row,projectId:result.projectId,project:projectRow};
  });}
 };
}
