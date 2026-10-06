import {ApiError} from './auth.ts';

export interface ReadBudgetConfig {
 D1_READ_BUDGET_ENABLED?:string;
 D1_SCAN_ROWS_PER_DAY?:string;
 D1_QUOTA_PAUSE_UNTIL?:string;
}
export const SCAN_RESERVATION=100000;
export const READINESS_SQL='SELECT id FROM main__notices ORDER BY id LIMIT 1';
const DEFAULT_DAILY_LIMIT=2500000;
const PREFIX='d1_scan_budget:v1:';

export function scanBudgetLimit(config:ReadBudgetConfig){
 const value=Number(config.D1_SCAN_ROWS_PER_DAY||DEFAULT_DAILY_LIMIT);
 if(!Number.isSafeInteger(value)||value<SCAN_RESERVATION||value>3000000)throw new ApiError(503,'READ_BUDGET_NOT_CONFIGURED');
 return value;
}
export function readBudgetReset(now=Date.now()){return(Math.floor(now/86400000)+1)*86400000;}
export function quotaPauseUntil(config:ReadBudgetConfig,now=Date.now()){
 const until=Date.parse(config.D1_QUOTA_PAUSE_UNTIL||'');
 return Number.isFinite(until)&&until>now?until:0;
}
export function isBudgetedScan(sql:string){
 if(!/^\s*SELECT\b/i.test(sql))return false;
 if(sql===READINESS_SQL)return false;
 // Point lookups and indexed owner/time-window reads keep working when
 // discretionary reporting/search has spent its allowance.
 const table=sql.match(/\bFROM\s+(main__(?:notices|applications|profiles|site_visitors|site_visit_events)|commerce__(?:orders|payments|payment_events))\b/i)?.[1]?.toLowerCase();
 if(!table)return false;
 if(/\b(?:WHERE|AND)\s+(?:\w+\.)?id\s*(?:=\s*\?|IN\s*\()/i.test(sql))return false;
 if(table==='main__applications'&&/\bWHERE\s+(?:\w+\.)?user_id\s*=\s*\?/i.test(sql))return false;
 if(table==='main__notices'&&/\bWHERE\s+(?:school_name|created_by)\s*(?:IN\s*\(|=\s*\?)/i.test(sql))return false;
 if(table.startsWith('commerce__')&&/\bWHERE\s+(?:order_no|order_id|merchant_order_no|payment_id|user_id)\s*=\s*\?/i.test(sql))return false;
 if(table==='main__site_visitors'&&/\bWHERE\s+(?:visitor_id\s*=|last_seen_at\s*>=)\s*\?/i.test(sql))return false;
 if(table==='main__site_visit_events'&&/\bWHERE\s+(?:visitor_id\s*=|created_at\s*>=)\s*\?/i.test(sql))return false;
 return true;
}

type UsageRecorder=(result:D1Result)=>void;
export function createReadBudget(db:D1Database,config:ReadBudgetConfig,record:UsageRecorder=()=>{}){
 const enabled=config.D1_READ_BUDGET_ENABLED==='true';
 const limit=enabled?scanBudgetLimit(config):0;
 return async(sqls:string[],execute:()=>Promise<D1Result[]>):Promise<D1Result[]>=>{
  const scans=enabled?sqls.map((sql,i)=>isBudgetedScan(sql)?i:-1).filter(i=>i>=0):[];
  if(!scans.length){const results=await execute();results.forEach(record);return results;}
  const now=Date.now(),key=PREFIX+new Date(now).toISOString().slice(0,10),reservation=scans.length*SCAN_RESERVATION;
  // Reserve before executing, atomically across isolates and concurrent callers.
  // Keep uncertain/failed executions charged instead of retrying at no cost.
  const ticket=await db.prepare('INSERT INTO _runtime_state(key,value) SELECT ?,? WHERE ?<=? ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+? AS TEXT) WHERE CAST(value AS INTEGER)+?<=? RETURNING value').bind(key,String(reservation),reservation,limit,reservation,reservation,limit).all<{value:string}>();
  record(ticket);
  if(!ticket.results.length)throw new ApiError(503,'READ_BUDGET_EXHAUSTED');
  const results=await execute();results.forEach(record);
  const actual=scans.reduce((sum,i)=>{
   const rows=results[i]?.meta?.rows_read;
   return sum+(Number.isSafeInteger(rows)&&rows>=0?rows:SCAN_RESERVATION);
  },0)+4;
  try{
   const settled=await db.prepare('UPDATE _runtime_state SET value=CAST(max(0,CAST(value AS INTEGER)+?) AS TEXT) WHERE key=? RETURNING value').bind(actual-reservation,key).all<{value:string}>();
   record(settled);
   if(actual>reservation+4)console.warn(JSON.stringify({event:'d1_scan_reservation_exceeded',rowsRead:actual-4,reservation,limit}));
  }catch{
   // A lost accounting write leaves the larger reservation in place.
   console.warn(JSON.stringify({event:'d1_scan_settlement_failed',reservation}));
  }
  return results;
 };
}

export async function readScanBudget(db:D1Database,config:ReadBudgetConfig,now=Date.now()){
 const limit=scanBudgetLimit(config);
 const used=Number(await db.prepare('SELECT value FROM _runtime_state WHERE key=?').bind(PREFIX+new Date(now).toISOString().slice(0,10)).first('value')||0);
 return{enabled:config.D1_READ_BUDGET_ENABLED==='true',limit,usedOrReserved:used,remaining:Math.max(0,limit-used),resetsAt:new Date(readBudgetReset(now)).toISOString(),scope:'guarded-scans-only'};
}
