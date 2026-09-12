import { createHash } from 'node:crypto';

export const SOURCE_REFS = ['mnotoltpythkayguhnrk', 'bqzchxacykhdmoczysfe'];
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
  if (typeof value === 'number' && (!Number.isFinite(value) || !Number.isSafeInteger(value))) throw new Error('LOSSY_NUMBER_REJECTED');
  if (value === undefined) throw new Error('MISSING_VALUE');
  return JSON.stringify(value);
}
export const sha256 = value => createHash('sha256').update(canonical(value)).digest('hex');
export function convertValue(value, pgType) {
  if (value === null) return null;
  if (value === undefined) throw new Error('MISSING_VALUE');
  if (['text','varchar','uuid'].includes(pgType)) {
    if (typeof value !== 'string') throw new Error('STRING_REQUIRED');
    if (pgType==='uuid' && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new Error('INVALID_UUID');
    return value;
  }
  if (pgType==='bool') { if (typeof value!=='boolean') throw new Error('INVALID_BOOLEAN'); return value ? 1 : 0; }
  if (['int2','int4','int8'].includes(pgType)) {
    if (typeof value==='number' && !Number.isSafeInteger(value)) throw new Error('LOSSY_INTEGER_REJECTED');
    if (!/^-?\d+$/.test(String(value))) throw new Error('INVALID_INTEGER');
    const n=BigInt(value);if(n < -9223372036854775808n || n>9223372036854775807n)throw new Error('INT64_RANGE');
    return n.toString();
  }
  if (pgType==='numeric') { if(typeof value!=='string'||!/^[-+]?\d+(\.\d+)?$/.test(value))throw new Error('DECIMAL_STRING_REQUIRED');return value; }
  if (['json','jsonb','array','_text'].includes(pgType)) {
    // Exporter must retain JSON numbers losslessly as raw JSON text. Never parse
    // and reserialize monetary/int64 values through JavaScript Number.
    if(typeof value==='string'){const parsed=JSON.parse(value);if(pgType==='_text'&&!Array.isArray(parsed))throw new Error('ARRAY_JSON_REQUIRED');return value;}
    return canonical(value);
  }
  if(pgType==='bytea'){if(typeof value!=='string'||!/^\\x(?:[0-9a-f]{2})*$/i.test(value))throw new Error('BYTEA_HEX_REQUIRED');return {hex:value.slice(2)};}
  if(pgType==='date'){if(value===''||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('INVALID_DATE');return value;}
  if(pgType==='timestamptz'){
    if(typeof value!=='string'||!/(Z|[+-]\d{2}:?\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('EXPLICIT_TIMEZONE_REQUIRED');
    return {raw:value,utc:new Date(value).toISOString()};
  }
  throw new Error('UNMAPPED_POSTGRES_TYPE:'+pgType);
}
export function transformRow(row, columns) {
  if(Object.keys(row).some(key=>!columns.some(c=>c.name===key)))throw new Error('UNMAPPED_COLUMN');
  const converted={};for(const column of columns)converted[column.name]=convertValue(row[column.name],column.type);
  if(Buffer.byteLength(canonical(converted))>1_800_000)throw new Error('D1_ROW_REQUIRES_LOSSLESS_SPLIT');
  return converted;
}
export function batchRows(rows, columnsPerRow, {reservedBindings=0,maxSqlBytes=80_000}={}) {
  const count=Math.floor((100-reservedBindings)/columnsPerRow);if(count<1)throw new Error('BINDING_LIMIT');
  const batches=[];let current=[],bytes=0;
  for(const row of rows){const size=Buffer.byteLength(canonical(row))+columnsPerRow*4;if(size>maxSqlBytes)throw new Error('ROW_REQUIRES_PARAMETERIZED_TRANSPORT');
    if(current.length>=count||bytes+size>maxSqlBytes){batches.push(current);current=[];bytes=0;}current.push(row);bytes+=size;
  }if(current.length)batches.push(current);return batches;
}
export function assertRemoteTarget(target, liveIdentity, now=Date.now()) {
  if(!target||target.mode!=='remote'||target.project!=='seekoffer'||!target.chromeVerified||target.plan!=='free'||!target.emptyVerified)throw new Error('TARGET_NOT_VERIFIED');
  if(!/^[0-9a-f]{32}$/.test(target.accountId)||!/^[-0-9a-f]{36}$/.test(target.databaseId))throw new Error('INVALID_TARGET_ID');
  if(liveIdentity.accountId!==target.accountId||liveIdentity.databaseId!==target.databaseId)throw new Error('TARGET_IDENTITY_MISMATCH');
  if(now-Date.parse(target.verifiedAt)>15*60_000||Date.parse(target.verifiedAt)>now)throw new Error('TARGET_ATTESTATION_EXPIRED');
  if(target.sourceRefs.some(ref=>!SOURCE_REFS.includes(ref)))throw new Error('SOURCE_SCOPE_VIOLATION');
}
export function budgetAllows(budget, batch) {
  const writeEstimate=batch.rows*(1+batch.indexCount)+batch.checkpointWrites;
  const readEstimate=batch.validationRows+batch.lookupRows;
  return budget.usedWrites+writeEstimate+budget.reserveWrites<=budget.maxWrites && budget.usedReads+readEstimate+budget.reserveReads<=budget.maxReads;
}
export const nextD1Reset = now => { const date=new Date(now);date.setUTCHours(24,0,0,0);return date.toISOString(); };
