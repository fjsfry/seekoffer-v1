import {describe,it,expect,vi,afterEach} from 'vitest';
import {createQuotaCircuit} from '../lib/service-quota-circuit';
import {createD1BackendClient} from '../lib/d1-backend-client';
afterEach(()=>vi.useRealTimers());
describe('finite service quota pause',()=>{
 it('does not loop after 402 and allows a request after UTC midnight without reloading',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-11T12:00:00Z'));
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({error:'SERVICE_QUOTA_EXCEEDED'},{status:402})).mockResolvedValue(Response.json({id:'synthetic-profile'}));
  const client=createD1BackendClient('https://migration.seekoffer.com.cn',async()=>'synthetic',fetcher);
  await expect(client.profile()).rejects.toMatchObject({status:402});for(let i=0;i<5;i++)await expect(client.profile()).rejects.toMatchObject({status:402});expect(fetcher).toHaveBeenCalledTimes(1);
  vi.setSystemTime(new Date('2026-09-12T00:00:00Z'));await expect(client.profile()).resolves.toMatchObject({id:'synthetic-profile'});expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('only permits explicit retry after one minute, and reopens no more work when the probe fails',()=>{let now=Date.parse('2026-09-11T12:00:00Z');const c=createQuotaCircuit(()=>now);c.restrict();expect(c.retryExplicitly()).toBe(false);now+=59999;expect(c.retryExplicitly()).toBe(false);now++;expect(c.retryExplicitly()).toBe(true);c.restrict();expect(c.retryExplicitly()).toBe(false);expect(c.blocked()).toBe(true);});
 it('business fill exhaustion does not disable account reads',async()=>{const f=vi.fn().mockResolvedValueOnce(Response.json({error:'FILL_LIMIT_REACHED'},{status:402})).mockResolvedValue(Response.json({ok:true}));const c=createD1BackendClient('https://migration.seekoffer.com.cn',async()=>'synthetic',f);await expect(c.profile()).rejects.toMatchObject({code:'FILL_LIMIT_REACHED'});await expect(c.profile()).resolves.toEqual({ok:true});});
});
