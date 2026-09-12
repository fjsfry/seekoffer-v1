'use client';
import {useState} from 'react';
import {LoaderCircle,ShieldCheck,X,ArrowRight} from 'lucide-react';
import {getSessionHydrationError} from '@/lib/user-session';
import {startNativeLogin} from '@/lib/native-auth-bridge';
import {prepareExplicitD1SignInRetry} from '@/lib/clerk-d1-session';
import {useUserSessionContext} from './user-session-provider';
export function NativeLoginPanel({onClose,onSuccess}:{onClose?:()=>void;onSuccess?:()=>void}){
 const {refresh}=useUserSessionContext();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function login(){if(busy)return;setBusy(true);setError('');try{prepareExplicitD1SignInRetry();await startNativeLogin();const user=await refresh();if(getSessionHydrationError()||!user?.loggedIn||!user.userId)throw new Error('登录已完成，账号资料尚未同步，请重试连接。');onSuccess?.();}catch(e){setError(e instanceof Error?e.message:'登录尚未完成，请稍后重试。');}finally{setBusy(false);}}
 return <section className="relative rounded-3xl bg-white p-8 text-ink"><button type="button" className="absolute right-4 top-4 rounded-full p-2" aria-label="关闭登录" onClick={onClose}><X className="h-5 w-5"/></button><ShieldCheck className="mb-5 h-10 w-10 text-teal-700"/><h2 className="text-2xl font-semibold">登录寻鹿 SeekOffer</h2><p className="mt-4 text-sm leading-7 text-slate-600">继续使用原来的寻鹿账号。系统浏览器会打开安全登录页，完成后自动回到桌面工作台；本机申请、日程和档案会保留。</p><button type="button" disabled={busy} onClick={()=>void login()} className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-teal-800 px-5 py-4 font-semibold text-white disabled:opacity-60">{busy?<LoaderCircle className="h-5 w-5 animate-spin"/>:<ArrowRight className="h-5 w-5"/>}{busy?'请在系统浏览器中完成登录':'在系统浏览器登录'}</button>{error?<p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>:null}</section>;
}
