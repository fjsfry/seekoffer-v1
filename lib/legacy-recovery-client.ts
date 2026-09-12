import {d1ClientForUser} from './clerk-d1-session';
import {getUserSession} from './user-session';
export type RecoveryProgress={processed:number;total:number;restored:number;alreadyPresent:number;conflicts:number;deleted:number;paused:boolean};
export async function restoreLegacyApplications(owner:string,records:Record<string,unknown>[],onProgress:(p:RecoveryProgress)=>void,signal?:AbortSignal){
  const progress:RecoveryProgress={processed:0,total:records.length,restored:0,alreadyPresent:0,conflicts:0,deleted:0,paused:false};
  const current=()=>{if(getUserSession()?.userId!==owner||!getUserSession()?.loggedIn)throw Error('账号已切换，恢复已暂停。');if(signal?.aborted)throw Error('恢复已暂停；已完成的部分仍保留，再次恢复会自动核对。');};
  const save=()=>{current();try{localStorage.setItem('seekoffer-legacy-recovery-progress:'+owner,JSON.stringify({...progress,updatedAt:new Date().toISOString()}));}catch{/* Original data and server checkpoints remain authoritative. */}onProgress({...progress});};
  save();
  try{
    for(let offset=0;offset<records.length;){
      current();const batch:Record<string,unknown>[]=[];
      while(offset+batch.length<records.length&&batch.length<8){const next=records[offset+batch.length];if(new TextEncoder().encode(JSON.stringify({records:[...batch,next]})).byteLength>240000){if(!batch.length)throw Error('有一条旧记录过大，需要单独核对；原内容已保留。');break;}batch.push(next);}
      const client=await d1ClientForUser(owner);current();const result=await client.recoverLegacy(batch,signal);current();
      const wanted=new Set(batch.map(r=>String(r.projectId)));if(!result||!Array.isArray(result.items)||result.items.length!==batch.length||new Set(result.items.map(r=>r.projectId)).size!==wanted.size||result.items.some(r=>!wanted.has(r.projectId)))throw Error('恢复回执不完整，已暂停；重试会核对已完成记录，不会重复导入。');
      for(const item of result.items){
        if(item.status==='imported')progress.restored++;
        else if(['already_recovered','already_present'].includes(item.status))progress.alreadyPresent++;
        else if(['remote_conflict','source_conflict','record_conflict'].includes(item.status))progress.conflicts++;
        else if(item.status==='deleted_after_recovery')progress.deleted++;
        else if(item.status==='budget_paused')progress.paused=true;
        else throw Error('恢复返回了未识别状态，已暂停核对。');
        if(item.status!=='budget_paused')progress.processed++;
      }
      save();if(progress.paused)break;offset+=batch.length;
    }
    return progress;
  }finally{if(getUserSession()?.userId===owner)window.dispatchEvent(new CustomEvent('seekoffer-applications-updated'));}
}
