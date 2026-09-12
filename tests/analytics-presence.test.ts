import {describe,it,expect} from 'vitest';
import {createAnalyticsPresence} from '../lib/client/analytics-presence';
const event={visitorId:'v_synthetic0000000001',sessionId:'s_synthetic0000000001',eventType:'pageview' as const,path:'/notices/',title:'通知',referrer:'',locale:'zh-CN',timezone:'Asia/Shanghai'};
const makeStore=()=>{const data=new Map<string,string>();return{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>{data.set(k,v);}};};
describe('D1 analytics isolation',()=>{
 it('shares the tab cooldown and records no heartbeat',async()=>{const store=makeStore();let n=0;const call=(async(_url,init)=>{n++;expect(JSON.parse(String(init?.body)).eventType).toBe('pageview');return new Response('{}');}) as typeof fetch;const a=createAnalyticsPresence(call,store),b=createAnalyticsPresence(call,store);await a(event);await b(event);expect(n).toBe(1);});
 it('stops only analytics after quota and resumes on a later visit after UTC reset',async()=>{let now=Date.parse('2026-09-10T23:59:00Z'),n=0;const track=createAnalyticsPresence((async()=>{n++;return new Response('{}',{status:402});}) as typeof fetch,makeStore(),()=>now);await track(event);now+=40000;await track({...event,path:'/me/'});expect(n).toBe(1);now+=60000;await track({...event,path:'/me/'});expect(n).toBe(2);});
 it('does not retry offline or allow concurrent navigations to pile up',async()=>{let release!:()=>void,n=0;const blocked=new Promise<void>(r=>release=r),track=createAnalyticsPresence((async()=>{n++;await blocked;throw Error('offline');}) as typeof fetch,makeStore());const first=track(event);await track({...event,path:'/other/'});release();await first;await track({...event,path:'/third/'});expect(n).toBe(1);});
});
