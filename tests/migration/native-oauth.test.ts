import {it,expect,vi} from 'vitest';
import {verifyNativeOAuth} from '../../workers/seekoffer-api/src/auth';
const config={CLERK_ISSUER:'https://clerk.seekoffer.com.cn',CLERK_BACKEND_SECRET:'synthetic-never-live',NATIVE_OAUTH_CLIENT_ID:'bXDBbWjJFxXqoeG3'};
function token(){const now=Date.now()/1000;return{object:'clerk_idp_oauth_access_token',id:'oat_synthetic',client_id:config.NATIVE_OAUTH_CLIENT_ID,subject:'user_'+'a'.repeat(27),scopes:['openid','email','profile'],revoked:false,expired:false,created_at:now-100,expiration:now+86000};}
it('accepts only the confirmed native OAuth client through the official online verifier',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json(token())).mockResolvedValueOnce(Response.json({id:token().subject,banned:false,locked:false,password_last_updated_at:null}));await expect(verifyNativeOAuth('synthetic-token',config,fetcher)).resolves.toEqual({issuer:config.CLERK_ISSUER,subject:token().subject});expect(fetcher.mock.calls[0][0]).toBe('https://api.clerk.com/v1/oauth_applications/access_tokens/verify');expect(fetcher.mock.calls[0][1].redirect).toBe('manual');
});
it('rejects another OAuth app, revoked tokens, wrong scopes, and unbounded expiration',async()=>{
 for(const patch of [{client_id:'other-client'},{revoked:true},{expired:true},{scopes:['email']},{expiration:Date.now()/1000-1},{expiration:Date.now()/1000+1000000},{subject:'org_synthetic'}, {created_at:Date.now()/1000+600}]){
  const fetcher=vi.fn().mockResolvedValue(Response.json({...token(),...patch}));await expect(verifyNativeOAuth('synthetic',config,fetcher)).rejects.toMatchObject({status:401});expect(fetcher).toHaveBeenCalledTimes(1);
 }
});
it('keeps service failure distinct from bad user credentials and does not retry',async()=>{
 for(const status of [302,401,403,429,503]){const fetcher=vi.fn().mockResolvedValue(new Response(null,{status}));await expect(verifyNativeOAuth('synthetic',config,fetcher)).rejects.toMatchObject({status:503});expect(fetcher).toHaveBeenCalledTimes(1);}
});

it('rejects an account banned in Clerk and tokens older than a password change',async()=>{for(const user of [{banned:true,locked:false,password_last_updated_at:null},{banned:false,locked:true,password_last_updated_at:null},{banned:false,locked:false,password_last_updated_at:Date.now()}]){const fetcher=vi.fn().mockResolvedValueOnce(Response.json(token())).mockResolvedValueOnce(Response.json({id:token().subject,...user}));await expect(verifyNativeOAuth('synthetic',config,fetcher)).rejects.toBeInstanceOf(Error);}});
