export async function probeD1({baseUrl,secret,fetcher=fetch}) {
  const url=new URL(baseUrl);
  if(!['migration.seekoffer.com.cn','localhost','127.0.0.1'].includes(url.hostname)||url.username||url.password||url.search||url.hash||(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('D1_PREFLIGHT_ORIGIN_NOT_ALLOWED');
  if(typeof secret!=='string'||secret.length<32)throw new Error('D1_PREFLIGHT_CREDENTIAL_MISSING');
  const response=await fetcher(new URL('/v1/internal/d1-status',url),{method:'POST',headers:{Accept:'application/json','x-seekoffer-ingest-secret':secret},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  const body=await response.json().catch(()=>null);
  const quota=response.status===402&&body?.error==='SERVICE_QUOTA_EXCEEDED';
  const budget=body?.budget;
  const valid=response.ok&&body?.available===true&&typeof budget?.enabled==='boolean'&&Number.isSafeInteger(budget?.remaining)&&budget.remaining>=0&&Number.isSafeInteger(budget?.usedOrReserved)&&Number.isSafeInteger(budget?.limit)&&typeof budget?.resetsAt==='string';
  const protectedBudget=valid&&budget.enabled&&budget.remaining<100000;
  return{event:'d1_readiness_preflight',checkedAt:new Date().toISOString(),baseUrl:url.origin,status:response.status,rowsRead:response.headers.get('x-d1-rows-read'),requestId:response.headers.get('x-request-id'),ready:valid&&!protectedBudget,deferred:quota||protectedBudget,reason:quota?'D1_SERVICE_QUOTA_EXCEEDED':protectedBudget?'D1_SCAN_BUDGET_EXHAUSTED':valid?null:`D1_READINESS_HTTP_${response.status}`,budget:valid?budget:null};
}
