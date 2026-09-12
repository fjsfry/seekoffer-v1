import {it,expect,vi} from 'vitest';
import {readOrInitializeProfile} from '../lib/clerk-d1-session';
import {D1RequestError} from '../lib/d1-backend-client';
it('initializes only a known mapping/verification gap, then rereads the authoritative profile',async()=>{
 const profile=vi.fn().mockRejectedValueOnce(new D1RequestError(403,'IDENTITY_MAPPING_REQUIRED')).mockResolvedValue({id:'original-uuid'}),bootstrap=vi.fn().mockResolvedValue({ready:true});
 expect(await readOrInitializeProfile({profile,bootstrap},'synthetic-token')).toEqual({id:'original-uuid'});expect(bootstrap).toHaveBeenCalledExactlyOnceWith('synthetic-token');expect(profile).toHaveBeenCalledTimes(2);
});
it('never initializes during normal login, quota errors, bans, unauthorized requests or outages',async()=>{
 for(const error of [new D1RequestError(402),new D1RequestError(401),new D1RequestError(403,'ACCOUNT_BLOCKED'),new D1RequestError(503),Error('offline')]){
  const profile=vi.fn().mockRejectedValue(error),bootstrap=vi.fn();await expect(readOrInitializeProfile({profile,bootstrap},'synthetic-token')).rejects.toBe(error);expect(bootstrap).not.toHaveBeenCalled();
 }
 const profile=vi.fn().mockResolvedValue({id:'original-uuid'}),bootstrap=vi.fn();await readOrInitializeProfile({profile,bootstrap},'synthetic-token');expect(bootstrap).not.toHaveBeenCalled();
});
it('a failed initialization cannot trigger an automatic retry or falsely complete login',async()=>{
 const profile=vi.fn().mockRejectedValue(new D1RequestError(403,'EMAIL_VERIFICATION_REQUIRED')),bootstrap=vi.fn().mockRejectedValue(new D1RequestError(503));
 await expect(readOrInitializeProfile({profile,bootstrap},'synthetic-token')).rejects.toMatchObject({status:503});expect(profile).toHaveBeenCalledTimes(1);expect(bootstrap).toHaveBeenCalledTimes(1);
});
