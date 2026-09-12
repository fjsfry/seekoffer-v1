export function clerkPortalUrl(returnTo:string,mode:'sign-in'|'sign-up'='sign-in'){
 const target=new URL(returnTo);if(target.protocol!=='https:'||!(target.hostname==='seekoffer.com.cn'||target.hostname.endsWith('.seekoffer.com.cn'))||target.username||target.password)throw new Error('当前客户端的安全登录返回地址尚未配置。');
 const allowed=new Set(['id','page','sort','q','school','region','major','category','discipline','range','status','deadline','fresh','date','type','kind','year','view']);
 for(const key of [...target.searchParams.keys()])if(!allowed.has(key))target.searchParams.delete(key);
 if(!/^#[A-Za-z][A-Za-z0-9:_-]{0,79}$/.test(target.hash))target.hash='';const portal=new URL('https://accounts.seekoffer.com.cn/'+mode);portal.searchParams.set('redirect_url',target.href);return portal.href;
}
export function portalUrlFromReferrer(referrer:string|null){
 try{const url=new URL(referrer||'');if(!['https://www.seekoffer.com.cn','https://seekoffer.com.cn'].includes(url.origin)||url.pathname.startsWith('/auth/'))throw Error('INVALID_RETURN_PAGE');return clerkPortalUrl(url.href);}
 catch{return clerkPortalUrl('https://www.seekoffer.com.cn/me/');}
}
