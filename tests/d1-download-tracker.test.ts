import {describe,it,expect,vi} from 'vitest';
import {createD1DownloadTracker} from '../lib/client/d1-download-tracker';

describe('D1 download attempt transport', () => {
  const store = () => {const data = new Map<string,string>(); return {getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>{data.set(k,v);}};};
  const flush = () => new Promise(resolve => setTimeout(resolve,0));
  it('deduplicates clicks across tabs without blocking the link', async () => {
    const fetcher=vi.fn(async()=>Response.json({recorded:true})),shared=store();let now=1789000000000;
    const a=createD1DownloadTracker(fetcher,shared,()=>now),b=createD1DownloadTracker(fetcher,shared,()=>now);
    expect(a()).toBe(true);expect(a()).toBe(false);expect(b()).toBe(false);await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher).toHaveBeenCalledWith('https://migration.seekoffer.com.cn/v1/desktop-download-attempt',expect.objectContaining({credentials:'omit',method:'POST'}));
    now+=31000;expect(b()).toBe(true);await flush();expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('persists quota backoff until next UTC day; no timer retries', async()=>{
    const fetcher=vi.fn(async()=>Response.json({}, {status:402})),shared=store();let now=1789000000000;
    const a=createD1DownloadTracker(fetcher,shared,()=>now);a();await flush();now+=600000;
    const b=createD1DownloadTracker(fetcher,shared,()=>now);expect(b()).toBe(false);expect(fetcher).toHaveBeenCalledTimes(1);
    now=(Math.floor(now/86400000)+1)*86400000;expect(b()).toBe(true);await flush();
  });
  it('network failure has a bounded cooldown and does not throw from the click',async()=>{
    const fetcher=vi.fn(async()=>{throw Error('offline');});let now=1789000000000;
    const a=createD1DownloadTracker(fetcher,store(),()=>now);expect(a()).toBe(true);await flush();now+=31000;expect(a()).toBe(false);now+=300000;expect(a()).toBe(true);await flush();
  });
});
