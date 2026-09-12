import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
const fixture=vi.hoisted(()=>({catalog:JSON.stringify([{id:'a',schoolName:'北京大学',projectName:'2026预推免通知',tags:[],deadlineDate:''},{id:'b',schoolName:'清华大学',projectName:'2026预推免通知',tags:[],deadlineDate:''}])}));
vi.mock('server-only',()=>({}));
vi.mock('node:fs',()=>({readFileSync:(path:string)=>path.endsWith('manifest.json')?JSON.stringify({sourceRef:'mnotoltpythkayguhnrk',publicWhitelistOnly:true,catalogSha256:createHash('sha256').update(fixture.catalog).digest('hex'),count:2,version:'fixture',observedAt:'2026-09-09'}):path.endsWith('catalog.json')?Buffer.from(fixture.catalog):JSON.stringify({id:'a',projectName:'OLD_BODY'})}));
beforeEach(()=>{vi.resetModules();vi.stubEnv('SEEKOFFER_OFFLINE_BUILD','false');});afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const response=(version:string,items:unknown[]=[],nextCursor:string|null=null)=>Response.json({version,items,nextCursor});
it('hiding a bundled notice removes it from the catalog and prevents detail resurrection',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response('v1')).mockResolvedValueOnce(response('v2',[{id:'a',visible:false}])).mockResolvedValueOnce(response('v2',[{id:'a',visible:false}]));vi.stubGlobal('fetch',fetcher);
 const m=await import('../lib/server/recovery-public-catalog');expect((await m.getLiveRecoveryCatalog()).items.map(x=>x.id)).toEqual(['a','b']);expect((await m.getLiveRecoveryCatalog()).items.map(x=>x.id)).toEqual(['b']);expect(await m.getRecoveryDetail('a')).toBeNull();expect(fetcher).toHaveBeenCalledTimes(3);
});
it('a 402 does not return a stale catalog and backoff suppresses repeated origin attempts',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response('{}',{status:402}));vi.stubGlobal('fetch',fetcher);const m=await import('../lib/server/recovery-public-catalog');await expect(m.getLiveRecoveryCatalog()).rejects.toMatchObject({status:402});await expect(m.getRecoveryDetail('a')).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1);
});
it('a detail withdrawn between overlay and detail reads cannot use the old bundled body',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response('v2',[{id:'a',visible:true,summary:{id:'a'}}])).mockResolvedValueOnce(new Response('{}',{status:404}));vi.stubGlobal('fetch',fetcher);const m=await import('../lib/server/recovery-public-catalog');expect(await m.getRecoveryDetail('a')).toBeNull();expect(String(fetcher.mock.calls[1][0])).toContain('/notice-detail?id=a');
});
it('mixed versions and malformed pagination fail without silently returning partial data',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(response('v1',[],'notice_override:a')).mockResolvedValueOnce(response('v2'));vi.stubGlobal('fetch',fetcher);const m=await import('../lib/server/recovery-notice-overrides');await expect(m.getRecoveryOverrides()).rejects.toThrow('NOTICE_UPDATE_DATA_INVALID');
});
it('only the build process offline flag bypasses overlay network access',async()=>{
 vi.stubEnv('SEEKOFFER_OFFLINE_BUILD','true');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const m=await import('../lib/server/recovery-public-catalog');expect((await m.getLiveRecoveryCatalog()).items).toHaveLength(2);expect(fetcher).not.toHaveBeenCalled();
});
