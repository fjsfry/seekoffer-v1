import test from 'node:test';import assert from 'node:assert/strict';
import {createD1BackendClient} from '../../../lib/d1-backend-client.ts';
test('client consumes every cursor and ID batch without losing unavailable applications',async()=>{
 const calls:{url:URL;body:any}[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input)),body=init?.body?JSON.parse(String(init.body)):null;calls.push({url,body});
  if(url.pathname.endsWith('/applications'))return Response.json(url.searchParams.has('after')?{items:[{id:'b',project_id:null,my_notes:'preserve'}],nextCursor:null}:{items:[{id:'a',project_id:'n-1'}],nextCursor:'a'});
  if(url.pathname.endsWith('/by-ids'))return Response.json({items:body.ids.map((id:string)=>({id})),unavailableIds:[]});
  return Response.json({sync_revision:2});
 };
 const c=createD1BackendClient('https://example.invalid',async()=>'synthetic-token',fetcher);
 const apps=await c.applications();assert.equal(apps.length,2);assert.equal(apps[1].my_notes,'preserve');
 const ids=Array.from({length:205},(_,i)=>'n-'+i);assert.equal((await c.applicationNotices([...ids,...ids])).items.length,205);
 assert.deepEqual(calls.filter(c=>c.body?.ids).map(c=>c.body.ids.length),[99,99,7]);const before=calls.length;await c.applicationNotices([]);assert.equal(calls.length,before);
 await c.updateApplication('a',1,{my_notes:'saved'});assert.deepEqual(calls.at(-1)?.body,{expectedRevision:1,patch:{my_notes:'saved'}});
});
test('malformed or repeated pagination fails instead of returning an incomplete successful snapshot',async()=>{
 for(const payload of [null,{items:[],nextCursor:'repeated'}]){
  let calls=0;const c=createD1BackendClient('https://example.invalid',async()=>'synthetic-token',async()=>{calls++;return Response.json(payload);});
  await assert.rejects(()=>c.applications());assert.ok(calls<=2);
 }
});
test('402 halts later requests and does not turn failed saves into successful responses',async()=>{
 let calls=0;const c=createD1BackendClient('https://example.invalid',async()=>'synthetic-token',async()=>{calls++;return Response.json({error:'quota'},{status:402});});
 await assert.rejects(()=>c.updateApplication('a',1,{my_notes:'keep local'}));await assert.rejects(()=>c.applications());assert.equal(calls,1);
});
