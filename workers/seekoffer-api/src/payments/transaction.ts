import {ApiError} from '../auth.ts';
// Every autofill payment/entitlement mutation must participate in this epoch.
// It detects changes between D1 reads and the atomic batch, replacing PG row locks.
export class PaymentTransaction {
 private statements:D1PreparedStatement[]=[];
 private sequences=new Map<string,{before:bigint;next:bigint}>();
 private constructor(private db:D1Database,private version:number){}
 static async begin(db:D1Database){
  const revision=await db.prepare("SELECT version FROM _business_revisions WHERE name='autofill_payment'").first<{version:number}>();
  if(!revision||!Number.isSafeInteger(revision.version))throw new ApiError(503,'PAYMENT_SCHEMA_NOT_READY');
  return new PaymentTransaction(db,revision.version);
 }
 async row(sql:string,params:unknown[]=[]){return this.db.prepare(sql).bind(...params).first<Record<string,any>>();}
 async rows(sql:string,params:unknown[]=[]){return (await this.db.prepare(sql).bind(...params).all<Record<string,any>>()).results;}
 add(sql:string,params:unknown[]=[]){this.statements.push(this.db.prepare(sql).bind(...params));}
 async nextId(table:string){
  if(!['autofill__license_events','autofill__commercial_payment_events','autofill__account_entitlement_events'].includes(table))throw new ApiError(503,'SEQUENCE_SCOPE');
  let value=this.sequences.get(table);
  if(!value){const row=await this.row('SELECT CAST(next_value AS TEXT) AS value FROM _business_sequences WHERE name=?',[table]);if(!row)throw new ApiError(503,'SEQUENCE_NOT_MIGRATED');const initial=BigInt(row.value);value={before:initial,next:initial};this.sequences.set(table,value);}
  if(value.next>=9223372036854775807n)throw new ApiError(503,'SEQUENCE_EXHAUSTED');return String(value.next++);
 }
 async event(table:string,record:Record<string,unknown>,deduplicate=false){
  const id=await this.nextId(table),keys=Object.keys(record);
  this.add('INSERT INTO '+table+'(id,'+keys.join(',')+') VALUES(CAST(? AS INTEGER),'+keys.map(()=>'?').join(',')+')'+(deduplicate?' ON CONFLICT(payment_id,event_type,payload_hash) DO NOTHING':''),[id,...Object.values(record)]);
 }
 async commit(){
  if(!this.statements.length)return;
  const id=crypto.randomUUID();let condition="(SELECT version FROM _business_revisions WHERE name='autofill_payment')=?";const params:unknown[]=[id,this.version];
  for(const [name,s]of this.sequences){condition+=' AND (SELECT next_value FROM _business_sequences WHERE name=?)=CAST(? AS INTEGER)';params.push(name,String(s.before));}
  const statements=[this.db.prepare('INSERT INTO _business_transaction_guards(id,valid) VALUES(?,CASE WHEN '+condition+' THEN 1 ELSE 0 END)').bind(...params),...this.statements];
  for(const [name,s]of this.sequences)statements.push(this.db.prepare('UPDATE _business_sequences SET next_value=CAST(? AS INTEGER) WHERE name=?').bind(String(s.next),name));
  statements.push(this.db.prepare("UPDATE _business_revisions SET version=version+1 WHERE name='autofill_payment'"),this.db.prepare('DELETE FROM _business_transaction_guards WHERE id=?').bind(id));
  try{await this.db.batch(statements);}catch(error){if(error instanceof Error&&/CHECK constraint failed: valid=1/.test(error.message))throw new ApiError(409,'PAYMENT_TRANSACTION_CONFLICT');throw error;}
 }
}
export function isoMicro(ms=Date.now()){return new Date(ms).toISOString().replace('Z','000Z');}
export function addDaysExact(value:string,days:number){const m=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{6})Z$/.exec(value);if(!m)throw new ApiError(503,'ENTITLEMENT_TIMESTAMP_NOT_CANONICAL');return new Date(Date.parse(m[1]+'Z')+days*86400000).toISOString().slice(0,19)+'.'+m[2]+'Z';}
