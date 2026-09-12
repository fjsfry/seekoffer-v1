'use client';
import {useRouter} from 'next/navigation';
import {LoginMethodPanel} from '@/components/login-method-panel';
import {SiteShell} from '@/components/site-shell';
import {readAuthIntent,clearAuthIntent} from '@/lib/auth-intent';
export default function SignInPage(){
 const router=useRouter();
 function signedIn(){
  const value=new URLSearchParams(window.location.search).get('next')||readAuthIntent()?.returnTo||'/me/';let target='/me/';
  try{const parsed=new URL(value,window.location.origin);if(parsed.origin===window.location.origin&&!parsed.pathname.startsWith('/auth/'))target=parsed.pathname+parsed.search+parsed.hash;}catch{}
  clearAuthIntent();router.replace(target);
 }
 return <SiteShell><div className="flex justify-center"><LoginMethodPanel onSuccess={signedIn}/></div><noscript>登录需要启用浏览器 JavaScript。你的账号与本地资料不会因此被修改。</noscript></SiteShell>;
}
