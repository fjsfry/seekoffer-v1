'use client';
import {useEffect,useState} from 'react';
import {AuthModal} from './auth-modal';
import {AuthActionBridge} from './auth-action-bridge';
import {sanitizeNoticeForPublicView} from '@/lib/notice-public-copy';
import {UserSessionProvider} from './user-session-provider';
import {SiteShell} from './site-shell';
import {NoticeDetailView} from './notice-detail-view';
import {getSafeNoticeReturnHref} from '@/lib/notice-links';
import type {PublicNoticeProject} from '@/lib/mock-data';

export function StaticNoticeDetailPreview(){
 const [project,setProject]=useState<PublicNoticeProject|null>(null),[error,setError]=useState(''),[returnHref,setReturnHref]=useState('/notices/');
 useEffect(()=>{const url=new URL(location.href),controller=new AbortController();let canceled=false;const id=url.pathname.replace(/\/$/,'')==='/notices/detail'?url.searchParams.get('id'):decodeURIComponent(url.pathname.split('/')[2]||'');setReturnHref(getSafeNoticeReturnHref(url.searchParams.get('returnTo'))||'/notices/');if(!id||id.length>180){setError('通知地址无效。');return;}
  void fetch('/api/public/notice-detail?id='+encodeURIComponent(id),{signal:controller.signal,credentials:'omit',cache:'no-store'}).then(async response=>{if(!response.ok)throw Error(response.status===404?'通知已撤回或暂不可用。':response.status===402?'通知服务额度暂不可用，请稍后手动重试。':'通知暂时无法读取，请稍后手动重试。');const row=await response.json() as PublicNoticeProject;if(canceled)return;if(row.id!==id)throw Error('通知响应未通过校验。');setProject(sanitizeNoticeForPublicView(row));document.title=row.schoolName+' '+row.projectName+' · 寻鹿 SeekOffer';}).catch(error=>{if(!canceled&&error.name!=='AbortError')setError(error.message);});return()=>{canceled=true;controller.abort();};
 },[]);
 return <UserSessionProvider><AuthActionBridge/><AuthModal/><SiteShell>{project?<NoticeDetailView project={project} returnHref={returnHref}/>:<div className="surface-card rounded-3xl p-8" role="status">{error||'正在读取这条通知…'}</div>}</SiteShell></UserSessionProvider>;
}
