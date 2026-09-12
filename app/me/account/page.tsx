'use client';
import Link from 'next/link';
import {SiteShell} from '@/components/site-shell';
import {AccountDeletionPanel} from '@/components/account-deletion-panel';
import {useUserSessionState} from '@/hooks/use-user-session';

export default function AccountPage(){
 const {ready,session}=useUserSessionState();
 return <SiteShell><div className="mx-auto max-w-3xl space-y-5 py-8"><Link href="/me/" className="text-teal-700">返回工作台</Link>{!ready?<p>正在核验账号…</p>:session?.loggedIn&&session.userId?<AccountDeletionPanel key={session.userId} userId={session.userId}/>:<p>请先<Link className="text-teal-700" href="/auth/sign-in/?next=%2Fme%2Faccount%2F">登录当前账号</Link>。</p>}</div></SiteShell>;
}
