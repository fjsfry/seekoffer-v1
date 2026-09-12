import test from 'node:test';import assert from 'node:assert/strict';import {fetchD1DailyNotices} from '../d1-public-source.mjs';
const date='2026-09-10',item=i=>({id:'public-'+i,publishDate:date,schoolName:'合成大学',projectName:'预推免通知',admin_note:'MUST_DROP',email:'MUST_DROP'});
const response=(page,items,total=43,version='snapshot-1')=>new Response(JSON.stringify({items,pagination:{total,page}}),{headers:{'x-notice-version':version}});
test('D1 public draft reads all filtered pages and only exports the approved whitelist',async()=>{
 const calls=[];const data=await fetchD1DailyNotices(date,async url=>{calls.push(url);const page=Number(new URL(url).searchParams.get('page'));return response(page,Array.from({length:page===1?40:3},(_,i)=>item((page-1)*40+i)));});
 assert.equal(data.notices.length,43);assert.equal(calls.length,2);assert.ok(calls.every(u=>u.startsWith('https://www.seekoffer.com.cn/api/public/notices/?')&&new URL(u).searchParams.get('date')===date));assert.ok(!JSON.stringify(data).includes('MUST_DROP'));
});
test('changing versions, incomplete data and quota failure cannot produce a successful draft',async()=>{
 await assert.rejects(fetchD1DailyNotices(date,async url=>{const p=Number(new URL(url).searchParams.get('page'));return response(p,p===1?Array.from({length:40},(_,i)=>item(i)):[item(40)],43,'version-'+p);}),/VERSION_CHANGED/);
 await assert.rejects(fetchD1DailyNotices(date,async()=>response(1,[],43)),/INCOMPLETE/);
 let calls=0;await assert.rejects(fetchD1DailyNotices(date,async()=>{calls++;return new Response('',{status:402});}),/HTTP_402/);assert.equal(calls,1);
});
