export type PresencePayload={visitorId:string;sessionId:string;eventType:'pageview';path:string;title:string;referrer:string;locale:string;timezone:string};
type Store=Pick<Storage,'getItem'|'setItem'>;
const STOP='seekoffer-analytics-stop-until';
export function createAnalyticsPresence(fetcher:typeof fetch,store:Store,now=Date.now,makeId=()=>crypto.randomUUID()){
 let inFlight=false,stoppedUntil=0;
 const seen=new Map<string,number>();
 const read=(key:string)=>{try{return Number(store.getItem(key)||0)||0;}catch{return 0;}};
 const write=(key:string,value:number)=>{try{store.setItem(key,String(value));}catch{}};
 return async(payload:PresencePayload)=>{
  const stamp=now(),key='seekoffer-analytics-page:'+payload.path;
  if(inFlight||Math.max(stoppedUntil,read(STOP))>stamp||Math.max(seen.get(key)||0,read(key))+30000>stamp)return;
  // Persist before the request so ordinary tabs share a cooldown. The server
  // additionally enforces deduplication inside its single D1 transaction.
  inFlight=true;seen.set(key,stamp);write(key,stamp);
  if(seen.size>100)seen.delete(seen.keys().next().value!);
  try{
   const response=await fetcher('https://migration.seekoffer.com.cn/v1/analytics',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...payload,requestId:makeId()}),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(8000)});
   if(response.status===402)stoppedUntil=(Math.floor(stamp/86400000)+1)*86400000;
   else if(!response.ok)stoppedUntil=stamp+5*60000;
  }catch{stoppedUntil=stamp+5*60000;}finally{if(stoppedUntil>stamp)write(STOP,stoppedUntil);inFlight=false;}
 };
}
