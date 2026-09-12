import {ApiError} from './auth.ts';
import {PaymentTransaction,isoMicro,addDaysExact} from './payments/transaction.ts';
type Row=Record<string,unknown>;
const json=(v:unknown)=>JSON.stringify(v);
const metadata=(r:Row)=>JSON.parse(String(r.metadata||'{}')) as Row;
const publicResult=(status:string,license:Row|null=null,count=0)=>({active:status==='active',status,planId:license?.plan_id??null,expiresAt:license?.entitlement_expires_at??null,maxDevices:Number(license?.max_devices||0),activeDevices:count});
async function hash(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
function random(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function code(v:unknown){if(typeof v!=='string'||v.length>100)throw new ApiError(400,'INVALID_LICENSE');const s=v.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g,'');if(s.length<20||s.length>64)throw new ApiError(400,'INVALID_LICENSE');return s;}
function token(v:unknown){return typeof v==='string'&&/^[A-Za-z0-9_-]{32,160}$/.test(v)?v:'';}
async function activeCount(t:PaymentTransaction,id:unknown){return Number((await t.row('SELECT count(*) n FROM autofill__license_activations WHERE license_id=? AND revoked_at IS NULL',[id]))?.n||0);}
async function execute(db:D1Database,body:Row,rateKey:string,installHash:string,limit:number,now:string){
 const t=await PaymentTransaction.begin(db);const budgetKey='license_requests_day:'+now.slice(0,10);const used=Number((await t.row('SELECT value FROM _runtime_state WHERE key=?',[budgetKey]))?.value||0);if(used>=limit)throw new ApiError(402,'LICENSE_DAILY_BUDGET');
 const rate=await t.row('SELECT * FROM autofill__license_rate_limits WHERE key_hash=?',[rateKey]);
 if(rate?.blocked_until&&String(rate.blocked_until)>now)throw new ApiError(429,'LICENSE_RATE_LIMITED');
 const reset=!rate||Date.parse(String(rate.window_started_at))<Date.parse(now)-900000;const count=reset?1:Number(rate.attempt_count)+1;const blocked=count>=12?isoMicro(Date.parse(now)+1800000):null;
 t.add('INSERT INTO autofill__license_rate_limits(key_hash,window_started_at,attempt_count,blocked_until,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(key_hash) DO UPDATE SET window_started_at=excluded.window_started_at,attempt_count=excluded.attempt_count,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at',[rateKey,reset?now:rate!.window_started_at,count,blocked,now]);
 t.add('INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[budgetKey,String(used+1)]);
 const finish=async(result:Row)=>{await t.commit();return result;};if(blocked){await t.commit();throw new ApiError(429,'LICENSE_RATE_LIMITED');}
 const action=body.action||'status';const version=typeof body.extensionVersion==='string'?body.extensionVersion:null,browser=typeof body.browserFamily==='string'?body.browserFamily:null;
 if(action==='activate'){
  const license=await t.row('SELECT * FROM autofill__license_codes WHERE code_hash=?',[await hash(code(body.licenseCode))]);if(!license)return finish(publicResult('invalid'));
  if(license.status!=='active')return finish(publicResult(String(license.status),license));
  if(license.not_before&&license.not_before>now)return finish({...publicResult('not_yet_valid',license),expiresAt:license.not_before});
  if(license.expires_at&&license.expires_at<=now)return finish({...publicResult('expired',license),expiresAt:license.expires_at});
  let expires=license.entitlement_expires_at;
  if(!expires){expires=addDaysExact(now,Number(license.duration_days));if(license.expires_at&&license.expires_at<expires)expires=license.expires_at;t.add('UPDATE autofill__license_codes SET entitlement_expires_at=?,first_redeemed_at=coalesce(first_redeemed_at,?),updated_at=? WHERE id=?',[expires,now,now,license.id]);}
  if(expires<=now)return finish({...publicResult('expired',license),expiresAt:expires});
  const existing=await t.row('SELECT * FROM autofill__license_activations WHERE license_id=? AND install_hash=?',[license.id,installHash]);let devices=await activeCount(t,license.id);
  if((!existing||existing.revoked_at)&&devices>=Number(license.max_devices))return finish({...publicResult('device_limit',license,devices),expiresAt:expires});
  const activationToken=random();
  t.add('INSERT INTO autofill__license_activations(license_id,install_hash,activation_token_hash,extension_version,browser_family,activated_at,last_checked_at,revoked_at) VALUES(?,?,?,?,?,?,?,NULL) ON CONFLICT(license_id,install_hash) DO UPDATE SET activation_token_hash=excluded.activation_token_hash,extension_version=excluded.extension_version,browser_family=excluded.browser_family,activated_at=CASE WHEN revoked_at IS NOT NULL THEN excluded.activated_at ELSE activated_at END,last_checked_at=excluded.last_checked_at,revoked_at=NULL',[license.id,installHash,await hash(activationToken),version,browser,now,now]);
  t.add('UPDATE autofill__license_codes SET redemption_count=redemption_count+1,updated_at=? WHERE id=?',[now,license.id]);await t.event('autofill__license_events',{license_id:license.id,install_hash:installHash,event_type:existing?'reactivated':'activated',event_data:json({extensionVersion:version||'',browser:browser||''})});
  if(!existing||existing.revoked_at)devices++;return finish({...publicResult('active',license,devices),expiresAt:expires,activationToken});
 }
 const bearer=token(body.activationToken);if(!bearer)return finish(publicResult('not_activated'));
 const activation=await t.row('SELECT * FROM autofill__license_activations WHERE activation_token_hash=? AND install_hash=? AND revoked_at IS NULL',[await hash(bearer),installHash]);if(!activation)return finish(publicResult('invalid'));
 const current=await t.row('SELECT * FROM autofill__license_codes WHERE id=?',[activation.license_id]);if(!current)return finish(publicResult('invalid'));
 if(action==='deactivate'){t.add('UPDATE autofill__license_activations SET revoked_at=?,last_checked_at=? WHERE id=?',[now,now,activation.id]);await t.event('autofill__license_events',{license_id:current.id,install_hash:installHash,event_type:'deactivated',event_data:'{}'});return finish(publicResult('deactivated'));}
 if(current.status!=='active')return finish(publicResult(String(current.status),current));
 if(action==='renew'){
  const renewal=await t.row('SELECT * FROM autofill__license_codes WHERE code_hash=?',[await hash(code(body.licenseCode))]);if(!renewal||renewal.id===current.id)return finish(publicResult('invalid_renewal',current));
  if(renewal.status==='disabled'&&metadata(renewal).renewed_license_id===current.id)return finish({...publicResult('active',current,await activeCount(t,current.id)),extendedDays:0});
  const anyDevice=await t.row('SELECT id FROM autofill__license_activations WHERE license_id=? LIMIT 1',[renewal.id]);
  if(renewal.status!=='active'||renewal.first_redeemed_at||renewal.entitlement_expires_at||Number(renewal.redemption_count)!==0||anyDevice)return finish(publicResult('renewal_'+renewal.status,current));
  if(renewal.not_before&&renewal.not_before>now)return finish(publicResult('not_yet_valid',current));
  if(renewal.expires_at&&renewal.expires_at<=now)return finish(publicResult('renewal_expired',current));
  const expiry=addDaysExact(current.entitlement_expires_at&&current.entitlement_expires_at>now?current.entitlement_expires_at:now,Number(renewal.duration_days));const prior=metadata(current).renewal_count,renewalCount=/^\d+$/.test(String(prior))?Number(prior)+1:1;if(!Number.isSafeInteger(renewalCount))throw new ApiError(503,'LICENSE_COUNTER_REVIEW');
  t.add('UPDATE autofill__license_codes SET plan_id=?,entitlement_expires_at=?,metadata=json_patch(metadata,?),updated_at=? WHERE id=?',[renewal.plan_id,expiry,json({renewal_count:renewalCount,last_renewed_at:now}),now,current.id]);
  t.add("UPDATE autofill__license_codes SET status='disabled',first_redeemed_at=?,entitlement_expires_at=?,redemption_count=1,metadata=json_patch(metadata,?),updated_at=? WHERE id=?",[now,expiry,json({renewed_license_id:current.id,renewed_at:now}),now,renewal.id]);
  t.add('UPDATE autofill__license_activations SET last_checked_at=?,extension_version=coalesce(?,extension_version),browser_family=coalesce(?,browser_family) WHERE id=?',[now,version,browser,activation.id]);
  await t.event('autofill__license_events',{license_id:current.id,install_hash:installHash,event_type:'renewed',event_data:json({renewal_license_id:renewal.id,extended_days:renewal.duration_days,expires_at:expiry})});return finish({...publicResult('active',current,await activeCount(t,current.id)),planId:renewal.plan_id,expiresAt:expiry,extendedDays:Number(renewal.duration_days)});
 }
 if(!current.entitlement_expires_at||current.entitlement_expires_at<=now)return finish(publicResult('expired',current));
 t.add('UPDATE autofill__license_activations SET last_checked_at=? WHERE id=?',[now,activation.id]);return finish(publicResult('active',current,await activeCount(t,current.id)));
}
export async function licenseAction(db:D1Database,body:Row,secret:string|undefined,ip:string,limit=100){
 if(!secret||secret.length<32)throw new ApiError(503,'LICENSE_CONFIGURATION_PENDING');
 if(Object.keys(body).some(k=>!['action','installId','activationToken','licenseCode','extensionVersion','browserFamily'].includes(k))||typeof body.installId!=='string'||!/^[A-Za-z0-9-]{16,120}$/.test(body.installId)||!['status','activate','renew','deactivate'].includes(String(body.action||'status')))throw new ApiError(400,'INVALID_LICENSE_REQUEST');
 for(const key of ['extensionVersion','browserFamily'])if(body[key]!==undefined&&(typeof body[key]!=='string'||String(body[key]).length>32))throw new ApiError(400,'INVALID_DEVICE_METADATA');
 if(['activate','renew'].includes(String(body.action)))code(body.licenseCode);
 if(body.action==='renew'&&!token(body.activationToken))throw new ApiError(400,'INVALID_RENEWAL');
 if(!Number.isInteger(limit)||limit<1||limit>1000)throw new ApiError(503,'LICENSE_BUDGET_CONFIGURATION');
 const rateKey=await hash(secret+'|license|'+ip+'|'+body.installId),installHash=await hash(body.installId);
 for(let attempt=0;attempt<3;attempt++){try{return await execute(db,body,rateKey,installHash,limit,isoMicro());}catch(e){if(!(e instanceof ApiError)||e.message!=='PAYMENT_TRANSACTION_CONFLICT'||attempt===2)throw e;}}
 throw new ApiError(503,'LICENSE_UNAVAILABLE');
}
