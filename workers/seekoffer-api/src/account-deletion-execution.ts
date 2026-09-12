import {ApiError} from './auth.ts';
import {accountDeletionImpact,type AccountDeletionConfig} from './account-deletion.ts';
import {PaymentTransaction,isoMicro} from './payments/transaction.ts';

type Config=AccountDeletionConfig&{ACCOUNT_DELETION_EXECUTION_ENABLED?:string;PAYMENT_PROCESSING_ENABLED?:string};
type Job={legacy_user_id:string;issuer:string;subject:string;request_id:string;state:string};

async function provider(config:Config,subject:string,method:'GET'|'DELETE',fetcher:typeof fetch){
 if(config.CLERK_ISSUER!=='https://clerk.seekoffer.com.cn'||!config.CLERK_BACKEND_SECRET?.startsWith('sk_live_')||!/^user_[A-Za-z0-9]{1,100}$/.test(subject))throw new ApiError(503,'DELETION_PROVIDER_NOT_CONFIGURED');
 try{return await fetcher('https://api.clerk.com/v1/users/'+encodeURIComponent(subject),{method,headers:{Authorization:'Bearer '+config.CLERK_BACKEND_SECRET,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(5000)});}catch{throw new ApiError(503,'DELETION_PROVIDER_UNAVAILABLE');}
}

// Operators process only a prior, freshly authenticated owner's explicit shared
// deletion request. Financial records and administrator identities require an
// individual reviewed workflow and are never cascaded by this path.
export async function processAccountDeletion(db:D1Database,body:Record<string,unknown>,operator:{role:string;recentlyVerified:boolean},config:Config,fetcher:typeof fetch=fetch){
 if(operator.role!=='super_admin')throw new ApiError(403,'SUPER_ADMIN_REQUIRED');
 if(!operator.recentlyVerified)throw new ApiError(403,'REAUTHENTICATION_REQUIRED');
 if(config.ACCOUNT_DELETION_EXECUTION_ENABLED!=='true'||config.PAYMENT_PROCESSING_ENABLED==='true')throw new ApiError(503,'ACCOUNT_DELETION_EXECUTION_DISABLED');
 if(Object.keys(body).some(k=>!['requestId','confirmation'].includes(k))||body.confirmation!=='process-verified-shared-deletion'||typeof body.requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.requestId))throw new ApiError(400,'INVALID_DELETION_PROCESS');
 let job=await db.prepare('SELECT legacy_user_id,issuer,subject,request_id,state FROM _account_deletion_requests WHERE request_id=?').bind(body.requestId).first<Job>();
 if(!job)throw new ApiError(404,'DELETION_REQUEST_NOT_FOUND');
 if(job.state==='completed')return {state:'completed',accountDeleted:true};
 if(job.state==='canceled')throw new ApiError(409,'DELETION_REQUEST_CANCELED');
 const owner=job.legacy_user_id,now=isoMicro(),dayKey='account_deletion_budget:'+now.slice(0,10);
 if(job.state==='review_required'){
  const plan=await accountDeletionImpact(db,owner,{issuer:job.issuer,subject:job.subject});
  if(plan.counts.websiteOrders||plan.counts.autofillOrders||plan.counts.autofillGrants||plan.counts.autofillEvents)throw new ApiError(409,'FINANCIAL_RETENTION_REVIEW_REQUIRED');
  if(await db.prepare('SELECT 1 FROM main__admin_users WHERE user_id=? LIMIT 1').bind(owner).first())throw new ApiError(409,'ADMIN_ACCOUNT_REVIEW_REQUIRED');
  const total=Object.values(plan.counts).reduce((a,n)=>a+n,0);
  if(total>500)throw new ApiError(409,'ACCOUNT_DATA_REVIEW_REQUIRED');
  // Include all indexes conservatively; this bounded route reserves from a
  // separate 5,000-write daily allowance, not the site's full D1 free budget.
  const indexes=Number(await db.prepare("SELECT count(*) n FROM sqlite_schema WHERE type='index'").first('n'));
  const reserve=500+total*(indexes+2);if(!Number.isSafeInteger(reserve)||reserve>5000)throw new ApiError(402,'DELETION_DAILY_BUDGET');
  const used=Number(await db.prepare('SELECT value FROM _runtime_state WHERE key=?').bind(dayKey).first('value')||0);if(!Number.isSafeInteger(used)||used<0||used+reserve>5000)throw new ApiError(402,'DELETION_DAILY_BUDGET');
  const providerAccount=await provider(config,job.subject,'GET',fetcher);
  if(providerAccount.status!==404){if(!providerAccount.ok)throw new ApiError(503,'DELETION_PROVIDER_UNAVAILABLE');const account=await providerAccount.json() as {id?:unknown};if(account.id!==job.subject)throw new ApiError(503,'DELETION_PROVIDER_IDENTITY_MISMATCH');}
  const t=await PaymentTransaction.begin(db),guard=crypto.randomUUID();
  t.add("INSERT INTO _business_transaction_guards(id,valid) VALUES(?,CASE WHEN (SELECT state FROM _account_deletion_requests WHERE request_id=?)='review_required' AND coalesce(CAST((SELECT value FROM _runtime_state WHERE key=?) AS INTEGER),0)+?<=5000 THEN 1 ELSE 0 END)",[guard,job.request_id,dayKey,reserve]);
  t.add("INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+? AS TEXT)",[dayKey,String(reserve),reserve]);
  // Keep original UUID tombstones so restore/import and old signed tokens
  // cannot recreate a deleted identity or remove financial foreign keys.
  t.add('UPDATE main__auth_subjects SET deleted_at=? WHERE id=?',[now,owner]);
  t.add('UPDATE autofill__auth_subjects SET deleted_at=? WHERE id=?',[now,owner]);
  for(const table of ['main__applications','main__workbench_states','main__user_vaults','main__ai_positioning_reports','main__ai_waitlist_leads','main__feedback_reports','main__offer_post_follows','main__billing_fill_sessions','main__user_entitlements','autofill__user_vaults'])t.add('DELETE FROM '+table+' WHERE user_id=?',[owner]);
  t.add('DELETE FROM main__profiles WHERE id=?',[owner]);
  t.add('DELETE FROM main__notices WHERE created_by=? AND is_private=1',[owner]);
  t.add('UPDATE main__notices SET created_by=NULL WHERE created_by=? AND is_private=0',[owner]);
  // Preserve other authors' replies and post IDs; remove this user's personal
  // content and make their contributions unavailable to every public reader.
  t.add("UPDATE main__offer_posts SET user_id=NULL,author_name='',school_name='',major='',undergraduate_background='',content='',title='',hidden_at=?,deleted_at=?,updated_at=? WHERE user_id=?",[now,now,now,owner]);
  t.add("UPDATE main__offer_comments SET user_id=NULL,author_name='',content='',hidden_at=?,deleted_at=?,updated_at=? WHERE user_id=?",[now,now,now,owner]);
  t.add('DELETE FROM autofill__account_entitlement_devices WHERE user_id=?',[owner]);
  t.add('DELETE FROM autofill__account_entitlements WHERE user_id=?',[owner]);
  t.add("UPDATE _account_deletion_requests SET state='d1_closed' WHERE request_id=?",[job.request_id]);
  t.add('DELETE FROM _business_transaction_guards WHERE id=?',[guard]);
  await t.commit();job={...job,state:'d1_closed'};
 }
 if(job.state==='d1_closed'){
  // Record dispatch before the external mutation. A lost response must never
  // cause an automatic second delete; the retry below only reads provider state.
  const claimed=await db.prepare("UPDATE _account_deletion_requests SET state='provider_unknown' WHERE request_id=? AND state='d1_closed' RETURNING request_id").bind(job.request_id).first();
  if(claimed){try{const response=await provider(config,job.subject,'DELETE',fetcher);if(!response.ok&&response.status!==404)return{state:'provider_unknown',accountDeleted:false,localAccountClosed:true};}catch{return{state:'provider_unknown',accountDeleted:false,localAccountClosed:true};}}
 }
 const confirmation=await provider(config,job.subject,'GET',fetcher);
 if(confirmation.status!==404)return{state:'provider_unknown',accountDeleted:false,localAccountClosed:true};
 await db.prepare("UPDATE _account_deletion_requests SET state='completed' WHERE request_id=? AND state='provider_unknown'").bind(job.request_id).run();
 return{state:'completed',accountDeleted:true,localDeviceDataDeleted:false,backupRetentionReviewRequired:true};
}
