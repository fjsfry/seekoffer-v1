import {it,expect,vi} from 'vitest';
import {createD1BackendClient,D1RequestError} from '../lib/d1-backend-client';
it('shows the actual free application limit without mislabeling it as a network failure',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({error:'FREE_APPLICATION_LIMIT',requestId:'synthetic'},{status:403}));const client=createD1BackendClient('https://migration.seekoffer.com.cn',async()=>'synthetic',fetcher);
 await expect(client.addApplication('notice-a')).rejects.toMatchObject({status:403,code:'FREE_APPLICATION_LIMIT',message:expect.stringContaining('最多可跟进5条')});
});
it('does not expose arbitrary backend error text or confuse auth rejection with quota',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({error:'unexpected private diagnostic'},{status:403}));const client=createD1BackendClient('https://migration.seekoffer.com.cn',async()=>'synthetic',fetcher);
 await expect(client.profile()).rejects.toMatchObject({status:403,code:undefined,message:'请求未完成，请保留待同步数据。'});
});
it('402 stops subsequent requests without an automatic retry',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({error:'SERVICE_QUOTA_EXCEEDED'},{status:402}));const client=createD1BackendClient('https://migration.seekoffer.com.cn',async()=>'synthetic',fetcher);
 await expect(client.applications()).rejects.toBeInstanceOf(D1RequestError);await expect(client.applications()).rejects.toMatchObject({status:402});expect(fetcher).toHaveBeenCalledTimes(1);
});
it('a monthly fill quota rejection does not disable the application workspace',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({error:'FILL_LIMIT_REACHED'},{status:402})).mockResolvedValueOnce(Response.json({items:[],nextCursor:null}));const client=createD1BackendClient('https://migration.seekoffer.com.cn',async()=>'synthetic',fetcher);
 await expect(client.billing({action:'prepare-fill-session'})).rejects.toMatchObject({status:402,code:'FILL_LIMIT_REACHED',message:expect.stringContaining('工作台与原有资料仍可使用')});
 await expect(client.applications()).resolves.toEqual([]);expect(fetcher).toHaveBeenCalledTimes(2);
});
