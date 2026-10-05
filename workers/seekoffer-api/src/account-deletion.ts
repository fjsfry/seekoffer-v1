import {ApiError,recentlyVerified} from './auth.ts';
import {readClerkUser,type BootstrapConfig} from './identity-bootstrap.ts';

const main='mnotoltpythkayguhnrk',autofill='bqzchxacykhdmoczysfe';
type Identity={issuer:string;subject:string;sessionId?:string;factorVerificationAge?:unknown};
export type AccountDeletionConfig=BootstrapConfig&{ACCOUNT_DELETION_REQUESTS_ENABLED?:string};
// Explicit source-derived ownership mapping. No email matching, UUID rewriting,
// or implicit merging of the two projects is allowed.
const owned=[
 ['applications','main__applications','user_id'],
 ['workbench','main__workbench_states','user_id'],
 ['profile','main__profiles','id'],
 ['encryptedVault','main__user_vaults','user_id'],
 ['reports','main__ai_positioning_reports','user_id'],
 ['feedback','main__feedback_reports','user_id'],
 ['waitlist','main__ai_waitlist_leads','user_id'],
 ['posts','main__offer_posts','user_id'],
 ['comments','main__offer_comments','user_id'],
 ['follows','main__offer_post_follows','user_id'],
 ['fillSessions','main__billing_fill_sessions','user_id'],
 ['websiteOrders','main__billing_orders','user_id'],
 ['websiteEntitlements','main__user_entitlements','user_id'],
 ['autofillOrders','autofill__commercial_orders','user_id'],
 ['autofillEntitlements','autofill__account_entitlements','user_id'],
 ['autofillDevices','autofill__account_entitlement_devices','user_id'],
 ['autofillGrants','autofill__account_entitlement_grants','user_id'],
 ['autofillEvents','autofill__account_entitlement_events','user_id'],
 ['autofillEncryptedVault','autofill__user_vaults','user_id']
] as const;

export async function accountDeletionImpact(db:D1Database,owner:string,identity:Identity){
 const links=await db.prepare('SELECT legacy_project_ref,legacy_user_id FROM _identity_links WHERE issuer=? AND subject=?').bind(identity.issuer,identity.subject).all<{legacy_project_ref:string;legacy_user_id:string}>();
 if(!links.results.some(r=>r.legacy_project_ref===main&&r.legacy_user_id===owner)||links.results.some(r=>![main,autofill].includes(r.legacy_project_ref)||r.legacy_user_id!==owner))throw new ApiError(409,'CROSS_PRODUCT_IDENTITY_REVIEW_REQUIRED');
 const counts:Record<string,number>={};
 for(const [label,table,column]of owned){
  const row=await db.prepare('SELECT count(*) AS n FROM (SELECT 1 FROM '+table+' WHERE '+column+'=? LIMIT 1001)').bind(owner).first<{n:number}>();
  if(!row||row.n>1000)throw new ApiError(409,'ACCOUNT_DATA_REVIEW_REQUIRED');
  counts[label]=row.n;
 }
 const privateRows=await db.prepare('SELECT count(*) AS n FROM (SELECT 1 FROM main__notices WHERE created_by=? AND is_private=1 LIMIT 1001)').bind(owner).first<{n:number}>();
 if(!privateRows||privateRows.n>1000)throw new ApiError(409,'ACCOUNT_DATA_REVIEW_REQUIRED');
 counts.privateProjects=privateRows.n;
 const authored=await db.prepare('SELECT count(*) AS n FROM (SELECT 1 FROM main__notices WHERE created_by=? AND is_private=0 LIMIT 1001)').bind(owner).first<{n:number}>();
 if(!authored||authored.n>1000)throw new ApiError(409,'ACCOUNT_DATA_REVIEW_REQUIRED');counts.publicAuthoredNotices=authored.n;
 const pending=await db.prepare("SELECT (SELECT count(*) FROM main__billing_orders WHERE user_id=? AND status='pending')+(SELECT count(*) FROM autofill__commercial_orders WHERE user_id=? AND status IN ('pending','contacted','paid')) AS n").bind(owner,owner).first<{n:number}>();
 return {counts,pendingOrders:pending?.n??0,sharedIdentity:true,scope:'shared-seekoffer-account',orderHistoryMustBeRetained:true,localDeviceDataIncluded:false,sourceBackupsIncluded:false};
}

// A verified request is not an account deletion. Execution is a separately
// gated administrator workflow; financial/large accounts require manual review.
export async function accountDeletionAction(db:D1Database,owner:string,identity:Identity,body:Record<string,unknown>,config:AccountDeletionConfig,fetcher:typeof fetch=fetch){
 if(config.ACCOUNT_DELETION_REQUESTS_ENABLED!=='true')throw new ApiError(503,'ACCOUNT_DELETION_MAINTENANCE');
 const action=body.action;
 if(!['impact','status','request'].includes(String(action))||Object.keys(body).some(k=>!['action','requestId','confirmation','scope'].includes(k)))throw new ApiError(400,'INVALID_DELETION_REQUEST');
 if(action==='status'){
  const row=await db.prepare('SELECT request_id AS requestId,state,requested_at AS requestedAt FROM _account_deletion_requests WHERE legacy_user_id=? AND issuer=? AND subject=?').bind(owner,identity.issuer,identity.subject).first();
  return {request:row,accountDeleted:false};
 }
 if(!recentlyVerified(identity))throw new ApiError(403,'REAUTHENTICATION_REQUIRED');
 await readClerkUser(identity,config,fetcher);
 if(action==='impact')return {impact:await accountDeletionImpact(db,owner,identity),accountDeleted:false};
 if(body.scope!=='shared-seekoffer-account'||body.confirmation!=='request-shared-account-deletion'||typeof body.requestId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.requestId))throw new ApiError(400,'SHARED_ACCOUNT_CONFIRMATION_REQUIRED');
 const existing=await db.prepare('SELECT issuer,subject,request_id,state FROM _account_deletion_requests WHERE legacy_user_id=?').bind(owner).first<{issuer:string;subject:string;request_id:string;state:string}>();
 if(existing){
  if(existing.issuer!==identity.issuer||existing.subject!==identity.subject||existing.request_id!==body.requestId)throw new ApiError(409,'DELETION_REQUEST_CONFLICT');
  return {requestId:existing.request_id,state:existing.state,accountDeleted:false};
 }
 const plan=await accountDeletionImpact(db,owner,identity),now=new Date().toISOString();
 const row=await db.prepare("INSERT INTO _account_deletion_requests(legacy_user_id,issuer,subject,request_id,scope,state,requested_at,impact_json) SELECT ?,?,?,?,'shared-seekoffer-account','review_required',?,? WHERE (SELECT count(*) FROM _account_deletion_requests WHERE requested_at>=?)<20 ON CONFLICT(legacy_user_id) DO NOTHING RETURNING request_id AS requestId,state")
  .bind(owner,identity.issuer,identity.subject,body.requestId,now,JSON.stringify(plan),now.slice(0,10)).first();
 if(!row){const raced=await db.prepare('SELECT request_id,state FROM _account_deletion_requests WHERE legacy_user_id=?').bind(owner).first<{request_id:string;state:string}>();if(raced?.request_id===body.requestId)return{requestId:raced.request_id,state:raced.state,accountDeleted:false};throw new ApiError(429,'DELETION_REQUEST_REVIEW_LIMIT');}
 return {...row,accountDeleted:false};
}
