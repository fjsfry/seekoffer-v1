// Publication is opt-in for this exact hostname. Other hosts keep the preview gate.
import preview,{readOnlyDatabase} from './static-preview';
import {publicReadError} from './read-error';
import {reviewedIndex,reviewedVersion} from './reviewed-notices';
import {publicOutageActive,outageSnapshotAt} from './notice-outage-window';
type Env=Parameters<typeof preview.fetch>[1]&{PUBLIC_WEBSITE_ORIGIN?:string;PUBLIC_WEBSITE_MODE?:string};
const origin='https://www.seekoffer.com.cn';
const publicPages=['/','/download/','/notices/','/deadlines/','/colleges/','/resources/','/competitions/','/knowledge/','/offers/','/gpa/','/consulting/','/guide/','/faq/','/data-quality/','/about/','/terms/','/privacy/','/disclaimer/'];
const escapeXml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
import {publicVisibility} from '../seekoffer-api/src/notice-sql';
const pending=new Map<string,Promise<string>>(),blocked=new Map<string,number>();
async function sitemap(db:D1Database,path:string){
 const version=await reviewedVersion(db);
 const match=/^\/sitemaps\/notices-(\d{1,5})\.xml$/.exec(path),page=match?Number(match[1]):0;
 if(path!=='/sitemap.xml'&&path!=='/sitemaps/pages.xml'&&(!match||page<1||String(page)!==match[1]))return new Response('Not found',{status:404});
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(version+':'+path));
 const key='https://seekoffer-sitemap.invalid/v1/'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
 const hit=await caches.default.match(key);if(hit)return new Response(hit.body,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'no-store'}});
 if((blocked.get(key)||0)>Date.now())throw Error('SITEMAP_BACKOFF');
 let job=pending.get(key);if(!job){
  job=(async()=>{
   try{
    const index=await reviewedIndex(db,version),count=index.rows.length;
    const pages=Math.ceil(count/500);if(pages>50000)throw Error('SITEMAP_INDEX_LIMIT');
    let xml='<?xml version="1.0" encoding="UTF-8"?>';
    if(path==='/sitemap.xml')xml+='<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/sitemaps/pages.xml',...Array.from({length:pages},(_,i)=>'/sitemaps/notices-'+(i+1)+'.xml')].map(p=>'<sitemap><loc>'+origin+p+'</loc></sitemap>').join('')+'</sitemapindex>';
    else{
     if(page>pages)return '';
     const links=path==='/sitemaps/pages.xml'?publicPages:[...index.byId.keys()].sort().slice((page-1)*500,page*500).map(id=>'/notices/'+encodeURIComponent(id)+'/');
     xml+='<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+links.map(p=>'<url><loc>'+escapeXml(origin+p)+'</loc></url>').join('')+'</urlset>';
    }
    if(!publicOutageActive()&&version!==await db.prepare("SELECT value FROM _runtime_state WHERE key='notice_version'").first('value'))throw Error('SITEMAP_VERSION_CHANGED');
    if(new TextEncoder().encode(xml).byteLength>512000)throw Error('SITEMAP_CACHE_ITEM_LIMIT');
    await caches.default.put(key,new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public,max-age=60'}}));return xml;
   }catch(e){if(blocked.size>=128)blocked.clear();blocked.set(key,Date.now()+15000);throw e;}finally{pending.delete(key);}
  })();pending.set(key,job);
 }
 const xml=await job;return new Response(xml||'Not found',{status:xml?200:404,headers:{'Content-Type':xml?'application/xml; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
}
export default{async fetch(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url),published=env.PUBLIC_WEBSITE_MODE==='live'&&env.PUBLIC_WEBSITE_ORIGIN===origin&&url.origin===origin;
 if(url.origin==='https://preview.seekoffer.com.cn'&&['preview','live'].includes(env.PUBLIC_WEBSITE_MODE||'')&&env.PUBLIC_WEBSITE_ORIGIN===origin){
  const expected=env.SEEKOFFER_FRONTEND_PREVIEW_TOKEN,auth=request.headers.get('authorization')||'';
  if(expected?.length>=48&&auth.length<=256){
   const digest=(s:string)=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));const [a,b]=await Promise.all([digest(auth),digest('Bearer '+expected)]);let diff=0;new Uint8Array(a).forEach((n,i)=>diff|=n^new Uint8Array(b)[i]);
   if(!diff){const target=new URL(url.pathname+url.search,origin);const r=await this.fetch(new Request(target,request),{...env,PUBLIC_WEBSITE_MODE:'live'});const result=new Response(r.body,r);result.headers.set('X-Robots-Tag','noindex, nofollow');return result;}
  }
 }
 if(!published)return preview.fetch(request,env);
 if(!env.SEEKOFFER_FRONTEND_PREVIEW_TOKEN||env.SEEKOFFER_FRONTEND_PREVIEW_TOKEN.length<48)return new Response('Site temporarily unavailable',{status:503});
 if(url.pathname==='/sitemap.xml'||url.pathname.startsWith('/sitemaps/')){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  try{const r=await sitemap(readOnlyDatabase(env.CORE,{reads:0,queries:0}),url.pathname);return request.method==='HEAD'?new Response(null,r):r;}catch(error){const failure=publicReadError(error);return Response.json({error:failure.message},{status:failure.status,headers:{'Cache-Control':'no-store','Retry-After':failure.status===402?'3600':'30'}});}
 }
 if(url.pathname==='/robots.txt'){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  return new Response(request.method==='HEAD'?null:'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /me/\nDisallow: /auth/\nDisallow: /_pages/\nDisallow: /_rsc/\nSitemap: '+origin+'/sitemap.xml\n',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 }
 // This capability stays inside the Worker; never forward it to a backend.
 const headers=new Headers(request.headers);headers.set('Authorization','Bearer '+env.SEEKOFFER_FRONTEND_PREVIEW_TOKEN);
 const result=await preview.fetch(new Request(request,{headers}),env),response=new Response(result.body,result);
 if(publicOutageActive()){response.headers.set('X-Public-Mode','reviewed-snapshot');response.headers.set('X-Public-Snapshot-At',outageSnapshotAt);}
 if(!/^\/(?:me|admin|auth|api|_pages|_rsc|_detail)(?:\/|$)/.test(url.pathname))response.headers.delete('X-Robots-Tag');
 response.headers.set('X-Content-Type-Options','nosniff');return response;
}};
