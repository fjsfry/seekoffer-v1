import {ApiError} from './auth.ts';

const MAIN='mnotoltpythkayguhnrk';
const ISSUER='https://clerk.seekoffer.com.cn';
export type BootstrapConfig={CLERK_ISSUER?:string;CLERK_BACKEND_SECRET?:string;NEW_ACCOUNTS_ENABLED?:string;NEW_ACCOUNTS_FROM?:string};
type Identity={issuer:string;subject:string};
type User={id:string;external_id:string|null;banned:boolean;locked:boolean;created_at:number;primary_email_address_id:string|null;email_addresses:{id:string;email_address?:string;verification:{status:string}|null}[]};
type Existing={legacy_user_id:string;id:string|null;deleted_at:string|null;banned_until:string|null;email_confirmed_at:string|null;moderation_status:string|null};

export async function readClerkUser(identity:Identity,config:BootstrapConfig,fetcher:typeof fetch):Promise<User>{
 if(identity.issuer!==ISSUER||config.CLERK_ISSUER!==ISSUER||!/^user_[A-Za-z0-9]{1,100}$/.test(identity.subject))throw new ApiError(401,'INVALID_IDENTITY');
 if(!config.CLERK_BACKEND_SECRET?.startsWith('sk_live_'))throw new ApiError(503,'ACCOUNT_PROVISIONING_PENDING');
 let response:Response;
 // workerd supports follow/manual, not Node's redirect:error. Manual plus a
 // non-2xx rejection below prevents credentials from following any redirect.
 try{response=await fetcher('https://api.clerk.com/v1/users/'+encodeURIComponent(identity.subject),{headers:{Authorization:'Bearer '+config.CLERK_BACKEND_SECRET,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(5000)});}catch{throw new ApiError(503,'AUTH_VERIFICATION_UNAVAILABLE');}
 if(response.status===404)throw new ApiError(403,'ACCOUNT_BLOCKED');
 if(!response.ok)throw new ApiError(503,'AUTH_VERIFICATION_UNAVAILABLE');
 // The authenticated Backend API is authoritative; browser metadata is never used.
 const user:User=await response.json();
 if(user.id!==identity.subject||typeof user.banned!=='boolean'||typeof user.locked!=='boolean'||!Array.isArray(user.email_addresses))throw new ApiError(503,'AUTH_VERIFICATION_UNAVAILABLE');
 if(user.banned||user.locked)throw new ApiError(403,'ACCOUNT_BLOCKED');
 const primary=user.email_addresses.find(email=>email.id===user.primary_email_address_id);
 if(!primary||primary.verification?.status!=='verified')throw new ApiError(403,'EMAIL_VERIFICATION_REQUIRED');
 return user;
}

async function newBusinessId(identity:Identity){
 // Stable UUIDv8 for new users only. Existing source UUIDs are never recalculated.
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('seekoffer:new-user:v1:'+identity.issuer+':'+identity.subject))).slice(0,16);
 bytes[6]=(bytes[6]&15)|128;bytes[8]=(bytes[8]&63)|128;
 const hex=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}

export async function bootstrapIdentity(db:D1Database,identity:Identity,config:BootstrapConfig,fetcher:typeof fetch=fetch,now=Date.now()){
 const existing=await db.prepare(`SELECT l.legacy_user_id,u.id,u.deleted_at,u.banned_until,u.email_confirmed_at,m.status AS moderation_status
  FROM _identity_links l LEFT JOIN main__auth_subjects u ON u.id=l.legacy_user_id LEFT JOIN main__user_moderation m ON m.user_id=u.id
  WHERE l.issuer=? AND l.subject=? AND l.legacy_project_ref=?`).bind(identity.issuer,identity.subject,MAIN).first<Existing>();
 if(existing){
  if(!existing.id)throw new ApiError(409,'IDENTITY_MAPPING_INCOMPLETE');
  if(existing.deleted_at||(existing.banned_until&&Date.parse(existing.banned_until)>now)||['blocked','banned','disabled','deleted'].includes(existing.moderation_status||''))throw new ApiError(403,'ACCOUNT_BLOCKED');
  if(existing.email_confirmed_at)return {userId:existing.id,created:false};
 }
 if(!existing&&config.NEW_ACCOUNTS_ENABLED!=='true')throw new ApiError(503,'REGISTRATION_MAINTENANCE');
 const user=await readClerkUser(identity,config,fetcher),timestamp=new Date(now).toISOString();
 if(existing){
  if(user.external_id!==MAIN+':'+existing.id)throw new ApiError(409,'IDENTITY_MAPPING_INCOMPLETE');
  // Preserve both the original account and its ban/moderation state.
  await db.prepare('UPDATE main__auth_subjects SET email_confirmed_at=? WHERE id=? AND email_confirmed_at IS NULL AND deleted_at IS NULL').bind(timestamp,existing.id).run();
  return {userId:existing.id,created:false};
 }
 const since=Date.parse(config.NEW_ACCOUNTS_FROM||'');
 if(!Number.isFinite(since)||!Number.isSafeInteger(user.created_at)||user.created_at<since||user.created_at>now+5000||user.external_id!==null)throw new ApiError(409,'IDENTITY_MAPPING_REQUIRED');
 const id=await newBusinessId(identity);
 // One atomic batch: concurrent first visits reuse the same mapping, never reimport profiles.
 await db.batch([
  db.prepare('INSERT INTO _identity_links(issuer,subject,legacy_project_ref,legacy_user_id) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').bind(identity.issuer,identity.subject,MAIN,id),
  db.prepare('INSERT INTO main__auth_subjects(id,created_at,email_confirmed_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM _identity_links WHERE issuer=? AND subject=? AND legacy_project_ref=? AND legacy_user_id=?) ON CONFLICT DO NOTHING').bind(id,timestamp,timestamp,identity.issuer,identity.subject,MAIN,id),
  db.prepare('INSERT INTO main__profiles(id) SELECT ? WHERE EXISTS(SELECT 1 FROM _identity_links WHERE issuer=? AND subject=? AND legacy_project_ref=? AND legacy_user_id=?) ON CONFLICT DO NOTHING').bind(id,identity.issuer,identity.subject,MAIN,id)
 ]);
 return {userId:id,created:true};
}
