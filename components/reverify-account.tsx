'use client';
import {useRef,useState} from 'react';
import {startClerkReverification,type Verification} from '@/lib/clerk-reverification';

export function ReverifyAccount({onVerified}:{onVerified:()=>void}) {
 const flow=useRef<Awaited<ReturnType<typeof startClerkReverification>>|null>(null),lock=useRef(false);
 const [state,setState]=useState<Verification|null>(null),[secret,setSecret]=useState(''),[emailSent,setEmailSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const accept=(value:Verification)=>{setState(value);setSecret('');if(value.status==='complete')onVerified();};
 async function action(run:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await run();}catch{setSecret('');setError('验证未完成，请检查输入和网络。账号若已切换，请刷新后重试。');}finally{lock.current=false;setBusy(false);}}
 const second=state?.status==='needs_second_factor',password=state?.supportedFirstFactors?.some(f=>f.strategy==='password'),email=state?.supportedFirstFactors?.find(f=>f.strategy==='email_code'),factor=state?.supportedSecondFactors?.find(f=>f.strategy==='totp')?.strategy||state?.supportedSecondFactors?.find(f=>f.strategy==='backup_code')?.strategy;
 return <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
  <p className="text-sm text-slate-600">此操作需要重新验证当前账号。</p>
  {(!state||state.status==='complete')&&<button className="btn-secondary" disabled={busy} onClick={()=>void action(async()=>{setEmailSent(false);setSecret('');flow.current=await startClerkReverification();accept(flow.current.initial);})}>{state?'重新安全验证':'开始安全验证'}</button>}
  {state&&state.status!=='complete'&&<>
   {!second&&email&&!emailSent&&<button className="btn-secondary" disabled={busy} onClick={()=>void action(async()=>{if(!email.emailAddressId||!flow.current)return;accept(await flow.current.email(email.emailAddressId));setEmailSent(true);})}>发送邮箱验证码</button>}
   {(second?Boolean(factor):password||emailSent)?<form className="space-y-3" onSubmit={event=>{event.preventDefault();void action(async()=>{if(!flow.current)return;const value=secret;setSecret('');accept(second?await flow.current.code(factor as 'totp'|'backup_code',value):emailSent?await flow.current.code('email_code',value):await flow.current.password(value));});}}>
    <label className="block text-sm">{second?(factor==='totp'?'身份验证器验证码':'备用验证码'):emailSent?'邮箱验证码':'当前密码'}<input required className="mt-2 block w-full rounded-xl border p-3" type={!second&&!emailSent?'password':'text'} autoComplete={!second&&!emailSent?'current-password':'one-time-code'} value={secret} onChange={event=>setSecret(event.target.value)} disabled={busy} maxLength={256}/></label>
    <button className="btn-primary" disabled={busy||!secret}>验证</button>
   </form>:<p className="text-sm">当前验证方式需要进一步支持，请通过寻鹿支持渠道处理；账号资料仍保留。</p>}
  </>}
  {state?.status==='complete'&&<p role="status" className="text-sm text-teal-700">身份验证通过，请继续操作。</p>}
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
 </div>;
}
