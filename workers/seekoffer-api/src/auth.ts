import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type {D1Database} from '@cloudflare/workers-types';
export class ApiError extends Error {
  status: number;
  constructor(status: number, code: string) { super(code); this.status=status; }
}
export interface AuthConfig { CLERK_ISSUER?: string; CLERK_AUDIENCE?: string; AUTHORIZED_PARTIES?: string; }
export async function verifyNativeOAuth(token:string,config:AuthConfig&{CLERK_BACKEND_SECRET?:string;NATIVE_OAUTH_CLIENT_ID?:string;EXTENSION_OAUTH_CLIENT_ID?:string},fetcher:typeof fetch=fetch,clientKind:'desktop'|'extension'='desktop'){
 const clientId=clientKind==='extension'?config.EXTENSION_OAUTH_CLIENT_ID:config.NATIVE_OAUTH_CLIENT_ID;const expectedClient=clientKind==='extension'?'uOgpBiVrePh1RgDk':'bXDBbWjJFxXqoeG3';
 if(config.CLERK_ISSUER!=='https://clerk.seekoffer.com.cn'||clientId!==expectedClient||!config.CLERK_BACKEND_SECRET)throw new ApiError(503,'NATIVE_AUTH_NOT_CONFIGURED');
 if(!token||token.length>16000)throw new ApiError(401,'INVALID_IDENTITY');
 let response:Response;try{response=await fetcher('https://api.clerk.com/v1/oauth_applications/access_tokens/verify',{method:'POST',headers:{Authorization:'Bearer '+config.CLERK_BACKEND_SECRET,'Content-Type':'application/json'},body:JSON.stringify({access_token:token}),redirect:'manual',signal:AbortSignal.timeout(8000)});}catch{throw new ApiError(503,'AUTH_VERIFICATION_UNAVAILABLE');}
 if([400,404,422].includes(response.status))throw new ApiError(401,'INVALID_IDENTITY');if(!response.ok)throw new ApiError(503,'AUTH_VERIFICATION_UNAVAILABLE');
 const value=await response.json() as Record<string,unknown>,now=Date.now()/1000;const scopes=value.scopes;
 if(value.object!=='clerk_idp_oauth_access_token'||value.client_id!==clientId||value.revoked!==false||value.expired!==false||typeof value.subject!=='string'||!/^user_[A-Za-z0-9]{20,64}$/.test(value.subject)||!Array.isArray(scopes)||!['openid','email','profile'].every(s=>scopes.includes(s))||typeof value.expiration!=='number'||value.expiration<=now||typeof value.created_at!=='number'||value.created_at>now+5||value.expiration-value.created_at>90000)throw new ApiError(401,'INVALID_IDENTITY');
 // Online token verification is intentional: revoked native grants must not
 // remain usable for the one-day OAuth token lifetime. D1 still checks owner/ban.
 let accountResponse:Response;try{accountResponse=await fetcher('https://api.clerk.com/v1/users/'+value.subject,{headers:{Authorization:'Bearer '+config.CLERK_BACKEND_SECRET},redirect:'manual',signal:AbortSignal.timeout(8000)});}catch{throw new ApiError(503,'AUTH_VERIFICATION_UNAVAILABLE');}
 if(!accountResponse.ok)throw new ApiError(503,'AUTH_VERIFICATION_UNAVAILABLE');const account=await accountResponse.json() as Record<string,unknown>;
 if(account.id!==value.subject||account.banned!==false||account.locked!==false)throw new ApiError(403,'ACCOUNT_BLOCKED');
 // Clerk user timestamps use milliseconds; OAuth verification timestamps use
 // seconds in the dated BAPI contract. Reject a token predating a password reset.
 if(typeof account.password_last_updated_at==='number'&&account.password_last_updated_at>value.created_at*1000)throw new ApiError(401,'NATIVE_REAUTHENTICATION_REQUIRED');
 return{issuer:config.CLERK_ISSUER,subject:value.subject};
}
const keySets=new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function verifyIdentity(token: string, config: AuthConfig, testKey?: JWTVerifyGetKey) {
  const issuer=config.CLERK_ISSUER;
  if(!issuer||!config.CLERK_AUDIENCE||!config.AUTHORIZED_PARTIES)throw new ApiError(503,'AUTH_CONFIGURATION_PENDING');
  const trusted=new URL(issuer);if(trusted.protocol!=='https:'||trusted.username||trusted.password)throw new ApiError(503,'INVALID_TRUST_CONFIGURATION');
  let key=testKey||keySets.get(issuer);
  if(!key){key=createRemoteJWKSet(new URL('/.well-known/jwks.json',issuer),{timeoutDuration:5000,cooldownDuration:30_000,cacheMaxAge:300_000});keySets.set(issuer,key as ReturnType<typeof createRemoteJWKSet>);}
  try{
    const {payload}=await jwtVerify(token,key,{issuer,audience:config.CLERK_AUDIENCE,algorithms:['RS256'],requiredClaims:['sub','sid','exp','iat','azp'],clockTolerance:5});
    if(!config.AUTHORIZED_PARTIES.split(',').includes(String(payload.azp)))throw new Error('azp');
    if(typeof payload.sub!=='string'||!payload.sub)throw new Error('sub');
    if(typeof payload.sid!=='string'||!payload.sid)throw new Error('sid');
    if(payload.sts!==undefined&&payload.sts!=='active')throw new Error('session_not_active');
    return {issuer,subject:payload.sub,...(Array.isArray(payload.fva)?{sessionId:payload.sid,factorVerificationAge:payload.fva}:{})};
  }catch{throw new ApiError(401,'INVALID_IDENTITY');}
}

// These ages are signed Clerk claims. JWT issue time and a native OAuth token's
// creation time are not evidence that the user recently proved a factor.
export function recentlyVerified(identity:{issuer:string;subject:string;sessionId?:string;factorVerificationAge?:unknown}){
 const ages=identity.factorVerificationAge;
 return Boolean(identity.sessionId)&&Array.isArray(ages)&&ages.length===2&&ages.every(n=>Number.isInteger(n)&&n>=-1)&&ages.some(n=>n>=0&&n<5);
}

export async function resolveOwner(db:D1Database,identity:{issuer:string;subject:string},project:string) {
  const row=await db.prepare(`SELECT u.id,u.blocked FROM identity_links l JOIN business_users u
    ON u.legacy_project_ref=l.legacy_project_ref AND u.id=l.legacy_user_id
    WHERE l.issuer=? AND l.subject=? AND l.legacy_project_ref=?`).bind(identity.issuer,identity.subject,project).first<{id:string;blocked:number}>();
  if(!row)throw new ApiError(403,'IDENTITY_MAPPING_REQUIRED');
  if(row.blocked)throw new ApiError(403,'ACCOUNT_BLOCKED');
  return row.id;
}
