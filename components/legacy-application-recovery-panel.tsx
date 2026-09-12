'use client';

import {useState,useMemo,useRef,useEffect} from 'react';
import {inspectLegacyApplications,inspectLegacyWorkbenchStorage} from '@/lib/legacy-application-recovery';
import {getUserSession} from '@/lib/user-session';
import {planLegacyApplications} from '@/lib/legacy-application-record';
import {restoreLegacyApplications,type RecoveryProgress} from '@/lib/legacy-recovery-client';

export function LegacyApplicationRecoveryPanel({owner}:{owner:string}) {
  const [result,setResult]=useState<ReturnType<typeof inspectLegacyApplications>|null>(null);
  const [error,setError]=useState('');
  const [workbench,setWorkbench]=useState<ReturnType<typeof inspectLegacyWorkbenchStorage>>([]);
  const [restoring,setRestoring]=useState(false),[progress,setProgress]=useState<RecoveryProgress|null>(null);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const plan=useMemo(()=>planLegacyApplications(result?.candidates.map(c=>c.record)||[],owner),[result,owner]);
  async function restore(){
    if(restoring||!plan.records.length)return;setRestoring(true);setError('');controller.current=new AbortController();
    try{await restoreLegacyApplications(owner,plan.records,setProgress,controller.current.signal);}
    catch(e){setError(e instanceof Error?e.message:'恢复暂时中断；已完成部分及原缓存均保留。');}
    finally{setRestoring(false);controller.current=null;}
  }
  function inspect() {
    setError('');
    try {
      const session=getUserSession();
      if(!session?.loggedIn||session.authProvider==='anonymous'||session.userId!==owner)throw new Error('请先完成当前账号登录，再检查本机记录。');
      setResult(inspectLegacyApplications(window.localStorage,owner));
      setWorkbench(inspectLegacyWorkbenchStorage(window.localStorage,owner));
    }catch {setResult(null);setWorkbench([]);setError('本机记录暂时无法读取，请保留当前浏览器数据并重新核对登录状态。');}
  }
  return <section id="legacy-record-recovery" className="product-card rounded-[24px] border border-amber-200 p-5">
    <h3 className="text-base font-semibold text-ink">找回旧版本机记录</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">请在原设备、原浏览器中检查。检查只在本机进行；点击恢复后，才会分批保存到当前账号的云端工作台。原缓存始终保留，云端已有不同内容不会被覆盖。</p>
    <button type="button" onClick={inspect} disabled={restoring} className="mt-3 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">检查旧版本机记录</button>
    {result&&plan.records.length>0&&<div className="mt-4 space-y-2 rounded-xl bg-amber-50 p-4 text-sm">
      <p>可恢复的不同申请 {plan.records.length} 条；相同缓存副本 {plan.duplicates} 份；内容冲突 {plan.conflicts} 组；格式待核对 {plan.invalid} 份。</p>
      {plan.defaultedRecords>0&&<p>其中 {plan.defaultedRecords} 条缺少部分旧版字段，将按原有默认值补齐；原缓存不变。</p>}
      <button type="button" disabled={restoring} onClick={()=>void restore()} className="rounded-xl bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50">{restoring?'正在分批恢复…':`恢复 ${plan.records.length} 条到当前账号`}</button>
      {restoring&&<button type="button" onClick={()=>controller.current?.abort()} className="ml-3 text-brand">暂停恢复</button>}
      {progress&&<p role="status">已核对 {progress.processed}/{progress.total} 条；本次新恢复 {progress.restored} 条；云端已保留 {progress.alreadyPresent} 条；冲突未覆盖 {progress.conflicts} 条；恢复后已删除 {progress.deleted} 条。{progress.paused?'恢复额度已达到安全上限，已完成部分保留，请稍后核对再继续。':''}</p>}
      <p>网络中断后可再次点击恢复，系统会先核对已完成记录。原通知缺失时，申请状态和备注仍会保留。</p>
    </div>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {result&&<div role="status" className="mt-4 space-y-2 text-sm text-slate-700">
      <p>检查结果：当前账号候选记录 {result.candidates.length} 份；归属待确认 {result.unassignedCount} 份；其他账号 {result.foreignAccountCount} 份；待检查格式 {result.invalidCount + result.unreadableKeys.length} 项。</p>
      <p>检查范围：旧版共用缓存、原账号独立缓存及迁移期间的缓存；没有改变任何记录的账号归属。</p>
      {workbench.map(item=><p key={item.label}>{item.label}：原账号独立缓存 {item.ownedCount} 项；归属待确认 {item.unassignedCount} 项；格式待检查 {item.invalidCount} 项。</p>)}
      {result.candidates.length>0?<>
        <p>已找到与当前原账号编号一致的本机记录，可能包含重复缓存。请按上面的去重数量执行恢复；原记录会继续保留，已恢复内容可在申请工作台查看。</p>
        <details className="rounded-xl border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer font-medium text-brand">查看属于当前账号的旧记录</summary>
          <ul className="mt-3 space-y-3">{result.candidates.map((item,index)=><li key={`${item.storageKey}:${item.index}`} className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium">旧记录 {index+1} · {String(item.record.myStatus||'状态待核对')}</p>
            <p className="mt-1 break-all text-xs text-slate-500">原通知编号：{item.record.projectId}</p>
            <p className="mt-2 whitespace-pre-wrap break-words">{String(item.record.myNotes||'未填写备注')}</p>
          </li>)}</ul>
        </details>
      </>:<p>{result.unassignedCount>0?'检测到没有明确账号编号的旧版试用记录，需要先核实归属，暂未合并到当前账号。':'没有找到明确属于当前账号的旧申请。请确认这是以前使用的浏览器配置文件，并从以前保存的主站书签进入；不同浏览器、不同网站地址和无痕窗口的数据不会互通。'}</p>}
      {result.foreignAccountCount>0&&<p>其他账号的记录未展示，也未合并。</p>}
      {(result.invalidCount>0||result.unreadableKeys.length>0)&&<p>部分旧数据格式需要进一步检查，原内容已保留，没有跳过后当作恢复成功。</p>}
    </div>}
  </section>;
}
