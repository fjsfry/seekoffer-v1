import type {D1Database} from '@cloudflare/workers-types';
import {ApiError} from './auth.ts';import {PaymentTransaction,isoMicro} from './payments/transaction.ts';
type Row=Record<string,any>;
async function hash(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
function random(){return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function summary(row:Row|null,activeDevices=0){return{source:'account',active:row?.status==='active',status:row?.status||'not_entitled',planId:row?.plan_id||null,expiresAt:row?.valid_until||null,maxDevices:Number(row?.max_devices||0),activeDevices,version:Number(row?.version||0)};}
async function execute(db:D1Database,owner:string,body:Row,write:boolean,now:string){
 const action=String(body.action||'summary'),t=await PaymentTransaction.begin(db);let entitlement=await t.row('SELECT * FROM autofill__account_entitlements WHERE user_id=?',[owner]);
 const count=async()=>entitlement?Number((await t.row('SELECT count(*) n FROM autofill__account_entitlement_devices WHERE entitlement_id=? AND revoked_at IS NULL',[entitlement.id]))?.n||0):0;
 const expired=entitlement?.status==='active'&&entitlement.valid_until<=now;
 const mutate=write&&!['summary','devices'].includes(action);
 if(mutate){const dayKey='license_requests_day:'+now.slice(0,10),daily=Number((await t.row('SELECT value FROM _runtime_state WHERE key=?',[dayKey]))?.value||0);if(daily>=100)throw new ApiError(402,'LICENSE_DAILY_BUDGET');t.add('INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[dayKey,String(daily+1)]);}
 if(expired&&entitlement){entitlement={...entitlement,status:'expired',version:Number(entitlement.version)+(mutate?1:0)};if(mutate){t.add("UPDATE autofill__account_entitlements SET status='expired',version=version+1,updated_at=? WHERE id=?",[now,entitlement.id]);t.add("UPDATE autofill__account_entitlement_devices SET revoked_at=?,last_checked_at=?,updated_at=?,metadata=json_patch(metadata,?) WHERE entitlement_id=? AND revoked_at IS NULL",[now,now,now,JSON.stringify({revoked_by:'account_expiry'}),entitlement.id]);await t.event('autofill__account_entitlement_events',{entitlement_id:entitlement.id,user_id:owner,event_type:'account_expired',event_data:JSON.stringify({valid_until:entitlement.valid_until})});}}
 const finish=async(value:Row)=>{await t.commit();return value;};
 if(action==='devices'){
  const install=typeof body.installId==='string'?await hash(body.installId):'';
  const rows=expired||entitlement?.status!=='active'?[]:await t.rows('SELECT id AS deviceId,browser_family AS browserFamily,extension_version AS extensionVersion,activated_at AS activatedAt,last_checked_at AS lastCheckedAt,install_hash=? AS isCurrent FROM autofill__account_entitlement_devices WHERE user_id=? AND revoked_at IS NULL ORDER BY isCurrent DESC,last_checked_at DESC,id',[install,owner]);
  return finish({devices:rows.map(r=>({...r,isCurrent:Boolean(r.isCurrent)}))});
 }
 if(action==='summary')return finish({entitlement:summary(entitlement,expired?0:await count())});
 if(!write)throw new ApiError(503,'ACCOUNT_ENTITLEMENT_MAINTENANCE');
 const key='autofill_device_actions:'+owner+':'+now.slice(0,13),used=Number((await t.row('SELECT value FROM _runtime_state WHERE key=?',[key]))?.value||0);if(used>=20)throw new ApiError(429,'DEVICE_ACTION_RATE_LIMIT');t.add('INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,String(used+1)]);
 if(action==='revoke_device'){
  const device=await t.row('SELECT * FROM autofill__account_entitlement_devices WHERE id=? AND user_id=?',[body.deviceId,owner]);if(!device)throw new ApiError(404,'DEVICE_NOT_FOUND');if(device.revoked_at)return finish({status:'already_revoked',deviceId:device.id});t.add('UPDATE autofill__account_entitlement_devices SET revoked_at=?,last_checked_at=?,updated_at=? WHERE id=?',[now,now,now,device.id]);await t.event('autofill__account_entitlement_events',{entitlement_id:device.entitlement_id,device_id:device.id,user_id:owner,event_type:'device_revoked',event_data:JSON.stringify({source:'account_device_manager'})});return finish({status:'revoked',deviceId:device.id});
 }
 const installHash=await hash(String(body.installId));
 if(action==='attach'){
  if(!entitlement)throw new ApiError(404,'NOT_ENTITLED');
  if(entitlement.status!=='active'){t.add('UPDATE autofill__account_entitlement_devices SET revoked_at=?,last_checked_at=?,updated_at=? WHERE entitlement_id=? AND revoked_at IS NULL',[now,now,now,entitlement.id]);return finish({entitlement:summary(entitlement),activationToken:null});}
  const existing=await t.row('SELECT * FROM autofill__account_entitlement_devices WHERE entitlement_id=? AND install_hash=?',[entitlement.id,installHash]);const active=await count();if((!existing||existing.revoked_at)&&active>=Number(entitlement.max_devices))throw new ApiError(409,'DEVICE_LIMIT');
  const deviceId=existing?.id||crypto.randomUUID(),activationToken=random();t.add('INSERT INTO autofill__account_entitlement_devices(id,entitlement_id,user_id,install_hash,activation_token_hash,extension_version,browser_family,activated_at,last_checked_at,revoked_at) VALUES(?,?,?,?,?,?,?,?,?,NULL) ON CONFLICT(entitlement_id,install_hash) DO UPDATE SET activation_token_hash=excluded.activation_token_hash,extension_version=excluded.extension_version,browser_family=excluded.browser_family,activated_at=CASE WHEN revoked_at IS NOT NULL THEN excluded.activated_at ELSE activated_at END,last_checked_at=excluded.last_checked_at,revoked_at=NULL,updated_at=excluded.last_checked_at',[deviceId,entitlement.id,owner,installHash,await hash(activationToken),body.extensionVersion||null,body.browserFamily||null,now,now]);await t.event('autofill__account_entitlement_events',{entitlement_id:entitlement.id,device_id:deviceId,user_id:owner,event_type:existing?'device_reactivated':'device_attached',event_data:JSON.stringify({browser:body.browserFamily||'',extension_version:body.extensionVersion||''})});return finish({entitlement:summary(entitlement,active+(!existing||existing.revoked_at?1:0)),activationToken,deviceId});
 }
 const device=await t.row('SELECT * FROM autofill__account_entitlement_devices WHERE user_id=? AND install_hash=? AND activation_token_hash=? AND revoked_at IS NULL',[owner,installHash,await hash(String(body.activationToken))]);if(!device)return finish({entitlement:{...summary(null),status:'invalid'}});
 if(action==='deactivate'){t.add('UPDATE autofill__account_entitlement_devices SET revoked_at=?,last_checked_at=?,updated_at=? WHERE id=?',[now,now,now,device.id]);await t.event('autofill__account_entitlement_events',{entitlement_id:device.entitlement_id,device_id:device.id,user_id:owner,event_type:'device_deactivated',event_data:'{}'});return finish({active:false,source:'account',status:'deactivated'});}
 if(!entitlement||entitlement.id!==device.entitlement_id)return finish({entitlement:{...summary(null),status:'invalid'}});
 if(entitlement.status!=='active'){t.add('UPDATE autofill__account_entitlement_devices SET revoked_at=?,last_checked_at=?,updated_at=? WHERE entitlement_id=? AND revoked_at IS NULL',[now,now,now,entitlement.id]);return finish({entitlement:summary(entitlement)});}
 t.add('UPDATE autofill__account_entitlement_devices SET last_checked_at=?,updated_at=? WHERE id=?',[now,now,device.id]);return finish({entitlement:summary(entitlement,await count())});
}
export async function accountEntitlementAction(db:D1Database,owner:string,body:Row,write:boolean){
 const action=String(body.action||'summary');if(Object.keys(body).some(k=>!['action','installId','activationToken','deviceId','extensionVersion','browserFamily'].includes(k))||!['summary','devices','attach','revoke_device','deactivate','status'].includes(action))throw new ApiError(400,'INVALID_ENTITLEMENT_ACTION');
 if((['attach','deactivate','status'].includes(action)||body.installId!==undefined)&&(typeof body.installId!=='string'||!/^[A-Za-z0-9-]{16,120}$/.test(body.installId)))throw new ApiError(400,'INVALID_INSTALL');
 if(action==='revoke_device'&&(typeof body.deviceId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.deviceId)))throw new ApiError(400,'INVALID_DEVICE');
 if(['status','deactivate'].includes(action)&&(typeof body.activationToken!=='string'||!/^[A-Za-z0-9_-]{32,160}$/.test(body.activationToken)))throw new ApiError(400,'INVALID_DEVICE_TOKEN');
 for(const k of ['extensionVersion','browserFamily'])if(body[k]!==undefined&&(typeof body[k]!=='string'||String(body[k]).length>32))throw new ApiError(400,'INVALID_DEVICE_METADATA');
 for(let i=0;i<3;i++){try{return await execute(db,owner,body,write,isoMicro());}catch(e){if(!(e instanceof ApiError)||e.message!=='PAYMENT_TRANSACTION_CONFLICT'||i===2)throw e;}}
 throw new ApiError(503,'ENTITLEMENT_UNAVAILABLE');
}
