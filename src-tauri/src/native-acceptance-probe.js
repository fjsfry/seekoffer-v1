(async()=>{
 const invoke=window.__TAURI_INTERNALS__.invoke;
 const report={count:0,total:0,bytes:0,detailMatches:false,scopeRejected:false,loginButton:[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='在系统浏览器登录'),error:null,testAccountMatches:false,profileStatus:0,profileUuidValid:false,applicationStatus:0,applicationFirstPageCount:0,applicationNoNextCursor:false,entitlementHttpStatus:0,entitlementState:'not_checked',privateRowsWritten:0};
 try{
  const list=await invoke('native_public_request',{path:'/api/public/notices/?page=1&pageSize=16&year=2026&sort=publish',method:'GET',body:null});report.count=list.items.length;report.total=list.pagination.total;report.bytes=new TextEncoder().encode(JSON.stringify(list)).length;
  const id=list.items[0].id;const detail=await invoke('native_public_request',{path:'/v1/public/notice-detail?id='+encodeURIComponent(id),method:'GET',body:null});report.detailMatches=Boolean(detail&&detail.id===id);
  try{await invoke('native_public_request',{path:'https://unrelated.invalid/',method:'GET',body:null});}catch{report.scopeRejected=true;}
  const session=await invoke('native_auth_session');
  // Only an explicitly supplied identity in an isolated acceptance build is allowed.
  const expectedEmail=window.__SEEKOFFER_ACCEPTANCE_TEST_EMAIL__;
  delete window.__SEEKOFFER_ACCEPTANCE_TEST_EMAIL__;
  if(typeof expectedEmail!=='string'||!expectedEmail||!session||session.email.toLowerCase()!==expectedEmail.toLowerCase())throw 'ACCEPTANCE_TEST_ACCOUNT_MISMATCH';
  report.testAccountMatches=true;
  const read=async(path,body)=>{
   const r=await fetch('https://migration.seekoffer.com.cn'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+session.accessToken,'X-Seekoffer-Client':'desktop-pkce',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000)});
   const written=r.headers.get('x-d1-rows-written');if(written===null||!/^\d+$/.test(written))throw 'ACCEPTANCE_METERING_UNAVAILABLE';report.privateRowsWritten+=Number(written);return{status:r.status,data:await r.json()};
  };
  const profile=await read('/v1/me/profile');report.profileStatus=profile.status;report.profileUuidValid=/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(profile.data?.id||'');
  if(profile.status!==200||!report.profileUuidValid)throw 'ACCEPTANCE_PROFILE_FAILED';
  const applications=await read('/v1/me/applications');report.applicationStatus=applications.status;report.applicationFirstPageCount=Array.isArray(applications.data?.items)?applications.data.items.length:0;report.applicationNoNextCursor=applications.data?.nextCursor===null;
  const entitlement=await read('/v1/me/autofill-entitlement',{action:'summary'});report.entitlementHttpStatus=entitlement.status;report.entitlementState=/^[a-z_]{1,30}$/.test(entitlement.data?.entitlement?.status||'')?entitlement.data.entitlement.status:'unavailable';
  if(report.privateRowsWritten!==0)throw 'ACCEPTANCE_UNEXPECTED_WRITE';
 }catch(e){report.error=/^[A-Z_]{1,90}$/.test(String(e))?String(e):'PUBLIC_PROBE_FAILED';}
 // No password, token, email, UUID, application detail or note enters this report.
 await invoke('native_acceptance_report',{report});
})();
