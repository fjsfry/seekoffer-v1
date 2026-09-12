// Pure reconciliation. Callers must keep returned operations in private memory.
const APP='app_3J2K0Pon22KSbO5Lt72HQbAI8e8',INSTANCE='ins_3J2MGZqJla2mM66OUuT7rYwK4O0';
const REFS=new Set(['mnotoltpythkayguhnrk','bqzchxacykhdmoczysfe']);
const fail=code=>{throw Error(code);};
export function reconcileClerkImports(plan,targets,checkpoints=[]){
 if(plan.format!=='seekoffer.clerk.production-import-plan.v2'||plan.applicationId!==APP||plan.productionInstanceId!==INSTANCE||!Array.isArray(plan.users))fail('AUTH_PLAN_SCOPE');
 const external=new Map(),emails=new Map(),known=new Map();
 for(const c of checkpoints){if(c.applicationId!==APP||c.productionInstanceId!==INSTANCE||!REFS.has(c.sourceRef))fail('CHECKPOINT_SCOPE');const id=c.sourceRef+':'+c.legacyUserId;if(known.has(id))fail('DUPLICATE_CHECKPOINT');known.set(id,c);}
 for(const t of targets){
  if(t.external_id){if(external.has(t.external_id))fail('DUPLICATE_TARGET_EXTERNAL_ID');external.set(t.external_id,t);}
  for(const e of t.email_addresses||[]){const key=e.email_address.toLowerCase();if(emails.has(key)&&emails.get(key).id!==t.id)fail('DUPLICATE_TARGET_EMAIL');emails.set(key,t);}
 }
 const seenEmails=new Set(),seenExternal=new Set(),operations=[];
 for(const u of plan.users){
  const body=u.body;if(!REFS.has(u.sourceRef)||body.external_id!==u.sourceRef+':'+u.legacyUserId)fail('SOURCE_IDENTITY_SCOPE');
  if(!Array.isArray(body.email_address)||body.email_address.length!==1||!body.email_address[0]||body.password_hasher!=='bcrypt'||!/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(body.password_digest||''))fail('SOURCE_AUTH_SHAPE');
  const key=body.email_address[0].toLowerCase();if(seenEmails.has(key)||seenExternal.has(body.external_id))fail('DUPLICATE_SOURCE_IDENTITY');seenEmails.add(key);seenExternal.add(body.external_id);
  const byEmail=emails.get(key),byExternal=external.get(body.external_id),checkpoint=known.get(body.external_id);
  if((byEmail&&!byExternal)||(byExternal&&byEmail?.id!==byExternal.id))fail('TARGET_IDENTITY_COLLISION');
  if(!byExternal){if(checkpoint)fail('CHECKPOINT_TARGET_MISSING');operations.push({action:'create',sourceRef:u.sourceRef,legacyUserId:u.legacyUserId,body});continue;}
  if(!checkpoint||checkpoint.clerkUserId!==byExternal.id)fail('UNJOURNALED_TARGET_REQUIRES_RECONCILIATION');
  if(!byExternal.password_enabled)fail('TARGET_PASSWORD_NOT_AVAILABLE');
  if(body.banned&&!byExternal.banned)fail('SOURCE_BAN_NOT_PRESERVED');
  const targetEmail=byExternal.email_addresses.find(e=>e.email_address.toLowerCase()===key);
  if(body.email_address_identification_status[0]==='verified'&&targetEmail.verification?.status!=='verified')fail('VERIFIED_EMAIL_NOT_PRESERVED');
  // An already imported account may have changed its password, verified email,
  // or been restricted since import. Never replay a source hash or downgrade it.
  operations.push({action:'preserve',sourceRef:u.sourceRef,legacyUserId:u.legacyUserId,clerkUserId:byExternal.id,passwordUpdateForbidden:true});
 }
 return operations;
}
