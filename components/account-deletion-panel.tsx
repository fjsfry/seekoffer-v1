'use client';
import {useRef,useState} from 'react';
import {d1ClientForUser} from '@/lib/clerk-d1-session';
import {D1RequestError} from '@/lib/d1-backend-client';
import {ReverifyAccount} from './reverify-account';
import Link from 'next/link';

type RequestState={requestId:string;state:string};
const states:Record<string,string>={review_required:'申请已收到，等待审核',d1_closed:'账号资料已关闭，认证账号待核验',provider_unknown:'认证处理结果待核验',completed:'注销处理已完成',canceled:'申请已取消'};
const labels:Record<string,string>={applications:'申请',workbench:'工作台',profile:'个人资料',encryptedVault:'加密档案',reports:'分析报告',feedback:'反馈',waitlist:'候补申请',posts:'帖子',comments:'评论',follows:'关注',fillSessions:'填报记录',websiteOrders:'网站订单',websiteEntitlements:'网站权益',autofillOrders:'填报订单',autofillEntitlements:'填报权益',autofillDevices:'填报设备',autofillGrants:'权益发放',autofillEvents:'权益流水',autofillEncryptedVault:'填报加密档案',privateProjects:'私人项目',publicAuthoredNotices:'发布的公开通知'};
export function AccountDeletionPanel({userId}:{userId:string}) {
 const [impact,setImpact]=useState<Record<string,number>|null>(null),[request,setRequest]=useState<RequestState|null>(null),[verified,setVerified]=useState(false),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const lock=useRef(false),requestId=useRef<string|null>(null);
 async function perform(action:'impact'|'status'|'request') {
  if(lock.current||action==='request'&&(!impact||!confirmed||!verified))return;
  lock.current=true;setBusy(true);setMessage('');
  try {
   const client=await d1ClientForUser(userId);
   if(action==='request'&&!requestId.current){const key='seekoffer.deletion-request:'+userId;try{requestId.current=sessionStorage.getItem(key);}catch{/* In-memory id still protects same-tab retries. */}requestId.current||=crypto.randomUUID();try{sessionStorage.setItem(key,requestId.current);}catch{/* No private data stored. */}}
   const result=await client.accountDeletion(action==='request'?{action,requestId:requestId.current,scope:'shared-seekoffer-account',confirmation:'request-shared-account-deletion'}:{action});
   if(action==='impact') {const value=result.impact as {counts?:Record<string,number>}|undefined;if(!value?.counts)throw Error();setImpact(value.counts);}
   if(action==='status'){const value=result.request as RequestState|null;if(value&&typeof value.requestId==='string'){requestId.current=value.requestId;setRequest(value);}else setMessage('当前没有已提交的注销申请。');}
   if(action==='request'){if(typeof result.requestId!=='string'||typeof result.state!=='string'||result.accountDeleted!==false)throw Error();setRequest({requestId:result.requestId,state:result.state});}
  }catch(error){setMessage(error instanceof D1RequestError?error.message:'未确认操作结果，请查询申请状态后再继续。');if(error instanceof D1RequestError&&error.code==='REAUTHENTICATION_REQUIRED')setVerified(false);}
  finally{lock.current=false;setBusy(false);}
 }
 const enabled=process.env.NEXT_PUBLIC_ACCOUNT_DELETION_REQUESTS_ENABLED==='true';
 return <section className="surface-card space-y-5 rounded-3xl p-6">
  <h1 className="text-2xl font-semibold">账号注销</h1>
  <p className="text-sm leading-7 text-slate-600">寻鹿网站、Windows 桌面端和保研填报共用此账号。注销会影响这些产品的云端资料与登录，不能仅注销其中一个产品。订单、权益流水及备份需要单独审核；本机档案不会在此自动删除。</p>
  {!enabled?<p role="status">在线注销申请暂未开放。可发邮件至 <a className="text-teal-700 underline" href="mailto:seekoffer@qq.com">seekoffer@qq.com</a> 申请，或查看<Link className="text-teal-700 underline" href="/faq/">帮助与支持</Link>。现有账号资料保留。</p>:<>
   <button className="btn-secondary" disabled={busy} onClick={()=>void perform('status')}>查询申请状态</button>
   {request?<div role="status"><p>{states[request.state]||'申请状态待核对'}</p><p className="mt-2 text-xs text-slate-500">申请编号：{request.requestId}</p>{request.state==='review_required'&&<p className="mt-2 text-sm">提交申请后尚未删除资料；如需撤回，请联系支持。</p>}</div>:<>
    {verified&&<p role="status" className="text-sm text-teal-700">身份验证通过，请查看注销影响。</p>}
    {!verified&&<ReverifyAccount onVerified={()=>{setVerified(true);setImpact(null);setConfirmed(false);}}/>}
    <button className="btn-secondary" disabled={!verified||busy} onClick={()=>void perform('impact')}>查看当前账号的注销影响</button>
    {impact&&<><dl className="grid grid-cols-2 gap-3 text-sm">{Object.entries(labels).map(([key,label])=><div key={key}><dt className="text-slate-500">{label}</dt><dd>{Number.isSafeInteger(impact[key])?impact[key]:'待核对'}</dd></div>)}</dl><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} disabled={busy}/>我了解这是网站、桌面端和填报共用账号的注销申请，愿意提交审核。</label><button className="btn-secondary text-red-700" disabled={!verified||!confirmed||busy} onClick={()=>void perform('request')}>提交注销申请</button></>}
   </>}
  </>}
  {message&&<p role="alert" className="text-sm text-red-700">{message}</p>}
 </section>;
}
