import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {build} from '../../workers/seekoffer-api/node_modules/esbuild/lib/main.js';

const dir = 'artifacts/notice-index-repair-20260919';
fs.mkdirSync(dir, {recursive:true});
const output = path.resolve(dir, 'capacity-oracle.mjs');
await build({stdin:{resolveDir:process.cwd(),contents:"export {reviewedIndex} from './workers/seekoffer-frontend/reviewed-notices';"},bundle:true,format:'esm',platform:'node',outfile:output,logLevel:'silent'});
const {reviewedIndex} = await import(pathToFileURL(output));
const rowCount=Number(process.env.INDEX_TEST_CHANGE_COUNT||5001);
assert.ok(Number.isInteger(rowCount)&&rowCount>=0&&rowCount<20000);
let requests = 0, writes = 0, version = 'synthetic-'+rowCount;
const spend = () => { if (++requests > 50) throw Error('Too many subrequests.'); };
globalThis.caches = {default:{async match(){spend();return undefined;},async put(){spend();}}};
const rows = Array.from({length:rowCount}, (_,i)=>({key:'notice_override:capacity-'+String(i).padStart(6,'0'),visible:0,catalog_projection:null}));
const db = {prepare(sql){let cursor='';return {
 bind(value){cursor=value;return this;},
 async first(){spend();return version;},
 async all(){spend();assert.ok(sql.startsWith('SELECT '));const limit=Number(sql.match(/LIMIT (\d+)/)?.[1]);assert.ok(limit>0&&limit<=500);return {results:rows.filter(r=>r.key>cursor).slice(0,limit)};},
 run(){writes++;throw Error('WRITE_FORBIDDEN');}
 };}};
try {
 const index = await reviewedIndex(db);
 assert.equal(index.version,version);assert.ok(requests<48);assert.equal(writes,0);
 const coldRequests=requests;requests=0;assert.equal(await reviewedIndex(db),index);assert.equal(requests,1);
 console.log(JSON.stringify({state:'CAPACITY_PASSED',changes:rows.length,coldRequests,warmRequests:requests,writes}));
} catch(error) {
 if(process.argv.includes('--expect-old-failure')) {
  assert.match(error.message,/Too many subrequests/);console.log(JSON.stringify({state:'OLD_FAILURE_REPRODUCED',changes:rows.length,requests,writes}));
 } else throw error;
}
