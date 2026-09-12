'use client';
import {useRef,useState} from 'react';
import {useUserSessionState} from '@/hooks/use-user-session';
import {getAdminSession} from '@/lib/admin-session';
import {d1ClientForUser} from '@/lib/clerk-d1-session';
import {D1RequestError} from '@/lib/d1-backend-client';
import {ReverifyAccount} from '@/components/reverify-account';
import Link from 'next/link';

type Item={requestId:string;userId:string;state:string;requestedAt:string};
function Operations({userId}:{userId:string}) {
 const [items,setItems]=useState<Item[]>([]),[after,setAfter]=useState<string|null>(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[verified,setVerified]=useState(false),[message,setMessage]=useState(''),[confirmation,setConfirmation]=useState(''),[refundNo,setRefundNo]=useState(''),[orderNo,setOrderNo]=useState(''),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[refund,setRefund]=useState<Record<string,unknown>|null>(null);
 const lock=useRef(false);
 async function act(run:(client:Awaited<ReturnType<typeof d1ClientForUser>>)=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setMessage('');try{await run(await d1ClientForUser(userId));}catch(error){setMessage(error instanceof D1RequestError?error.message:'未确认操作结果。请查询原记录，勿重复新建。');if(error instanceof D1RequestError&&error.code==='REAUTHENTICATION_REQUIRED')setVerified(false);}finally{lock.current=false;setBusy(false);}}
 function list(cursor=''){void act(async client=>{const page=await client.accountDeletionQueue(cursor);setItems(previous=>cursor?[...previous,...page.items]:page.items);setAfter(page.nextCursor);setLoaded(true);});}
 const execution=process.env.NEXT_PUBLIC_ACCOUNT_DELETION_EXECUTION_ENABLED==='true',refundEnabled=process.env.NEXT_PUBLIC_REFUNDS_ENABLED==='true';
 const field='mt-1 block w-full rounded-xl border border-slate-200 p-3';
 return <div className="space-y-6"><h1 className="text-2xl font-semibold">账号与订单处理</h1>
  {(execution||refundEnabled)&&<ReverifyAccount onVerified={()=>setVerified(true)}/>}
  <section className="surface-card space-y-4 rounded-3xl p-5"><h2 className="text-xl font-semibold">注销申请审核</h2><button className="btn-secondary" disabled={busy} onClick={()=>list()}>读取申请</button>
   {loaded&&!items.length&&<p>暂无注销申请。</p>}
   {items.map(item=><div key={item.requestId} className="rounded-xl border p-4 text-sm"><p>账号 UUID：{item.userId}</p><p>申请编号：{item.requestId}</p><p>{item.requestedAt} · {item.state}</p>{execution&&item.state!=='completed'&&<button className="btn-secondary mt-3" disabled={busy||!verified||confirmation!==item.requestId} onClick={()=>void act(async client=>{const result=await client.processAccountDeletion(item.requestId);setMessage(result.accountDeleted===true?'该申请的注销处理已完成。':'处理结果待核验，尚未确认注销完成。');setItems(previous=>previous.map(row=>row.requestId===item.requestId?{...row,state:String(result.state)}:row));setConfirmation('');})}>处理此已审核申请</button>}</div>)}
   {after&&<button className="btn-secondary" disabled={busy} onClick={()=>list(after)}>加载下一页</button>}
   {execution?<label className="block text-sm">核对共享账号影响后，输入需要处理的完整申请编号<input className={field} value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={busy}/></label>:<p className="text-sm text-slate-600">当前只可审核。注销执行尚未启用，涉及财务、管理员或大量资料的账号需单独处理。</p>}
  </section>
  <section className="surface-card space-y-4 rounded-3xl p-5"><h2 className="text-xl font-semibold">保研订单退款</h2><p className="text-sm text-slate-600">仅处理原保研订单，不使用此商户处理网站会员订单。结果不明确时查询原退款单。</p>
   <label className="block text-sm">退款单号<input className={field} value={refundNo} onChange={event=>{setRefundNo(event.target.value.trim());setRefund(null);}} maxLength={32} disabled={busy}/></label>
   <button className="btn-secondary" disabled={busy||!refundNo} onClick={()=>void act(async client=>setRefund(await client.refund({action:'status',refundNo})))}>读取已有退款状态</button>
   {refund&&<div role="status" className="text-sm"><p>状态：{String(refund.status||'待确认')}</p><p>金额（分）：{String(refund.amountCents??'待核对')}</p><p>订单调整：{refund.affectsOrder?'是':'否'}；权益调整：{refund.affectsEntitlement?'是':'否'}</p></div>}
   {refundEnabled?<>
    <button className="btn-secondary" disabled={busy||!verified||!refundNo} onClick={()=>void act(async client=>setRefund(await client.refund({action:'query',refundNo})))}>向原支付方查询</button>
    <label className="block text-sm">原保研订单号<input className={field} value={orderNo} onChange={event=>setOrderNo(event.target.value.trim())} maxLength={32} disabled={busy}/></label>
    <label className="block text-sm">全额退款金额（分）<input className={field} inputMode="numeric" value={amount} onChange={event=>setAmount(event.target.value)} maxLength={10} disabled={busy}/></label>
    <label className="block text-sm">退款原因<input className={field} value={reason} onChange={event=>setReason(event.target.value)} maxLength={300} disabled={busy}/></label>
    <p className="text-sm">确认原订单和完整金额后，填写本次唯一退款单号。重试须使用同一单号；已有退款需先核对状态。</p>
    <button className="btn-secondary text-red-700" disabled={busy||!verified||!orderNo||!refundNo||!reason||!/^\d+$/.test(amount)} onClick={()=>void act(async client=>setRefund(await client.refund({action:'create',orderNo,refundNo,reason,amountCents:Number(amount)})))}>确认提交退款</button>
   </>:<p className="text-sm text-slate-600">退款提交与支付方查询尚未启用。</p>}
  </section>
  {message&&<p role="status" className="text-sm text-red-700">{message}</p>}
 </div>;
}
export default function AccountOperationsPage(){
 const {ready,session}=useUserSessionState();if(!ready)return <p>正在核验账号…</p>;
 if(!session?.userId||getAdminSession()?.role!=='super_admin')return <p>此页面仅供超级管理员处理，服务端会再次核验权限。</p>;
 const available=process.env.NEXT_PUBLIC_ACCOUNT_DELETION_REQUESTS_ENABLED==='true'||process.env.NEXT_PUBLIC_ACCOUNT_DELETION_EXECUTION_ENABLED==='true'||process.env.NEXT_PUBLIC_REFUNDS_ENABLED==='true';
 if(!available)return <section className="surface-card space-y-4 rounded-3xl p-6"><h1 className="text-2xl font-semibold">账号与订单处理</h1><p role="status">在线注销审核与退款处理尚未开放，现有账号、订单和权益记录保留。请继续通过现有支持渠道处理申请。</p><Link className="text-brand" href="/admin/dashboard/">返回后台概览</Link></section>;
 return <Operations key={session.userId} userId={session.userId}/>;
}
