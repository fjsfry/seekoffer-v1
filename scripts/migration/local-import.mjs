import { DatabaseSync } from 'node:sqlite';
import { SOURCE_REFS, canonical, sha256, transformRow, batchRows, budgetAllows } from './transform.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Local conversion rehearsal only. It cannot issue any Cloudflare requests.
export function importLocalSnapshot(db, snapshot, budget, { dryRun=false }={}) {
  if(!SOURCE_REFS.includes(snapshot.sourceProjectRef))throw new Error('SOURCE_SCOPE_VIOLATION');
  if(snapshot.layer!=='synthetic-fixture')throw new Error('REAL_DATA_REQUIRES_ENCRYPTED_BACKUP_AND_PRIVATE_OUTPUT_GATE');
  const results=[];let nextBatch=0;
  for(const table of snapshot.tables){
    if(table.schema==='auth')throw new Error('AUTH_MUST_REMAIN_IN_SEPARATE_ENCRYPTED_ARCHIVE');
    if(!table.primaryKey.length)throw new Error('PRIMARY_KEY_REQUIRED');
    const prepared=table.rows.map(row=>{
      const converted=transformRow(row,table.columns);const pk=canonical(table.primaryKey.map(k=>converted[k]));
      return [snapshot.sourceProjectRef,table.schema,table.name,pk,canonical(converted),sha256(converted)];
    });
    const keys=prepared.map(r=>r[3]);if(new Set(keys).size!==keys.length)throw new Error('DUPLICATE_SOURCE_PK');
    const batches=batchRows(prepared,6);
    for(const [number,batch]of batches.entries()){
      const digest=sha256(batch);const receipt=db.prepare('SELECT sha256,row_count FROM migration_batches WHERE snapshot_id=? AND table_name=? AND batch_no=?').get(snapshot.id,table.schema+'.'+table.name,number);
      if(receipt){if(receipt.sha256!==digest||receipt.row_count!==batch.length)throw new Error('RESUME_SNAPSHOT_CHANGED');results.push({table:table.name,batch:number,status:'already-verified'});continue;}
      const estimate={rows:batch.length,indexCount:1,checkpointWrites:2,validationRows:batch.length,lookupRows:batch.length};
      if(!budgetAllows(budget,estimate))return {status:'budget-stop',nextBatch:number,table:table.name,results};
      if(dryRun){results.push({table:table.name,batch:number,status:'dry-run',rows:batch.length});continue;}
      db.exec('BEGIN IMMEDIATE');
      try{
        for(const row of batch){
          const existing=db.prepare('SELECT sha256 FROM migration_source_records WHERE legacy_project_ref=? AND schema_name=? AND table_name=? AND source_pk=?').get(...row.slice(0,4));
          if(existing){if(existing.sha256!==row[5])throw new Error('TARGET_ROW_CONFLICT');}
          else db.prepare('INSERT INTO migration_source_records VALUES(?,?,?,?,?,?)').run(...row);
        }
        db.prepare('INSERT INTO migration_batches VALUES(?,?,?,?,?)').run(snapshot.id,table.schema+'.'+table.name,number,digest,batch.length);
        for(const row of batch){const restored=db.prepare('SELECT source_payload,sha256 FROM migration_source_records WHERE legacy_project_ref=? AND schema_name=? AND table_name=? AND source_pk=?').get(...row.slice(0,4));if(restored.sha256!==row[5]||restored.source_payload!==row[4])throw new Error('BATCH_READBACK_MISMATCH');}
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      budget.usedWrites+=estimate.rows*2+2;budget.usedReads+=estimate.rows*2;nextBatch=number+1;
      results.push({table:table.name,batch:number,status:'verified',rows:batch.length,sha256:digest});
    }
  }
  return {status:dryRun?'dry-run':'local-verified',nextBatch,results,budget};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [input,destination]=process.argv.slice(2);if(!input||!destination)throw new Error('Use fixture.json LOCAL_DATABASE --dry-run (optional)');
  const db=new DatabaseSync(destination);const snapshot=JSON.parse(readFileSync(input,'utf8'));
  const budget={usedWrites:0,usedReads:0,maxWrites:80_000,maxReads:4_000_000,reserveWrites:10_000,reserveReads:500_000};
  try{console.log(JSON.stringify(importLocalSnapshot(db,snapshot,budget,{dryRun:process.argv.includes('--dry-run')})));}finally{db.close();}
}
