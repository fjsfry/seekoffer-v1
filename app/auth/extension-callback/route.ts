// OAuth returns only a short-lived code. The extension alone holds the PKCE
// verifier. Never log this request URL, persist it, or render third-party assets.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
export function GET(request:Request){
 const url=new URL(request.url),params=url.searchParams,state=params.get('state')||'';
 const match=/^seekoffer-v1\.([a-p]{32})\.([A-Za-z0-9_-]{43})$/.exec(state);
 if(url.origin!=='https://www.seekoffer.com.cn'||!match||params.getAll('state').length!==1)return new Response('Invalid authorization response.',{status:400,headers});
 const target=new URL('https://'+match[1]+'.chromiumapp.org/clerk-callback');target.searchParams.set('state',state);
 if(params.has('error')){const code=params.get('error')||'';if(params.getAll('error').length!==1||!/^[a-z_]{1,60}$/.test(code))return new Response('Invalid authorization response.',{status:400,headers});target.searchParams.set('error',code);}
 else{const code=params.get('code')||'';if(params.getAll('code').length!==1||code.length<8||code.length>4096||/[\u0000-\u0020]/.test(code))return new Response('Invalid authorization response.',{status:400,headers});target.searchParams.set('code',code);}
 return new Response(null,{status:303,headers:{...headers,Location:target.href}});
}
