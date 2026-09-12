import {describe,it,expect,vi} from 'vitest';
import {startClerkReverification,type Verification} from '../lib/clerk-reverification';
import type {ClerkBrowser} from '../lib/clerk-d1-session';
const need:Verification={status:'needs_first_factor',supportedFirstFactors:[{strategy:'password'}]},complete:Verification={status:'complete'};
function fixture(){
 const session={id:'synthetic-session',getToken:vi.fn(async()=> 'synthetic-token'),startVerification:vi.fn(async()=>need),prepareFirstFactorVerification:vi.fn(async()=>need),attemptFirstFactorVerification:vi.fn(async()=>complete),attemptSecondFactorVerification:vi.fn(async()=>complete)};
 const clerk={session,user:{id:'user_synthetic'},load:async()=>{},addListener:()=>()=>{},signOut:async()=>{}} satisfies ClerkBrowser;
 return{session,clerk,load:async()=>clerk};
}
describe('sensitive account operation reverification',()=>{
 it('requires Clerk multi-factor verification and refreshes only after completion',async()=>{const f=fixture(),flow=await startClerkReverification(f.load);expect(f.session.startVerification).toHaveBeenCalledWith({level:'multi_factor'});expect(f.session.getToken).not.toHaveBeenCalled();await flow.password('synthetic-password');expect(f.session.getToken).toHaveBeenCalledWith({skipCache:true});});
 it('does not treat the first factor as success when MFA remains required',async()=>{const f=fixture();f.session.attemptFirstFactorVerification.mockResolvedValue({status:'needs_second_factor',supportedSecondFactors:[{strategy:'totp'}]});const flow=await startClerkReverification(f.load);expect((await flow.password('synthetic-password')).status).toBe('needs_second_factor');expect(f.session.getToken).not.toHaveBeenCalled();await flow.code('totp','synthetic-code');expect(f.session.getToken).toHaveBeenCalledTimes(1);});
 it('stops when the account changes before credentials are submitted',async()=>{const f=fixture(),flow=await startClerkReverification(f.load);f.clerk.user={id:'user_other'};await expect(flow.password('synthetic-password')).rejects.toThrow('账号已切换');expect(f.session.attemptFirstFactorVerification).not.toHaveBeenCalled();});
 it('rejects a response belonging to a replaced session',async()=>{const f=fixture(),flow=await startClerkReverification(f.load);f.session.attemptFirstFactorVerification.mockImplementation(async()=>{f.clerk.user={id:'user_other'};return complete;});await expect(flow.password('synthetic-password')).rejects.toThrow('账号已切换');expect(f.session.getToken).not.toHaveBeenCalled();});
});
