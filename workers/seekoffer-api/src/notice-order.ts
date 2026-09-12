import {ApiError} from './auth';
type Row=Record<string,unknown>;
type Order={sourceRank:number;schoolRank:number};
const compare=new Intl.Collator('zh-CN').compare;
function previous(row:Row|null):Order&{schoolName:string}|null{
 if(!row?.catalog_projection||row.admin_status!=='published'||row.is_private||row.admin_deleted_at||row.source_site==='用户手动录入'||String(row.id).startsWith('custom-'))return null;
 try{const p=JSON.parse(String(row.catalog_projection));if(!Number.isFinite(p.sourceRank)||!Number.isFinite(p.schoolRank)||typeof p.schoolName!=='string')throw Error();return p;}catch{throw new ApiError(503,'NOTICE_ORDER_INVALID');}
}
// Called once per <=6-row mutation. Existing schools/records retain their ranks.
// Only a new school or an unprojected record needs the bounded distinct-school query.
export async function prepareNoticeOrder(db:D1Database,changes:{before:Row|null;after:Row}[],rowsGuarded=false){
 const version=await db.prepare("SELECT value FROM _runtime_state WHERE key='notice_version'").first<string>('value');
 const visible=changes.filter(c=>c.after.admin_status==='published'&&!c.after.is_private&&!c.after.admin_deleted_at);
 const orders=new Map<string,Order>();
 const needing=visible.filter(c=>{const p=previous(c.before);if(p&&p.schoolName===c.after.school_name){orders.set(String(c.after.id),p);return false;}return true;});
 if(needing.length){
  const result=await db.prepare("SELECT json_extract(catalog_projection,'$.schoolName') name,min(json_extract(catalog_projection,'$.schoolRank')) low,max(json_extract(catalog_projection,'$.schoolRank')) high,max(json_extract(catalog_projection,'$.sourceRank')) source FROM main__notices WHERE catalog_projection IS NOT NULL AND is_private=0 AND admin_status='published' AND admin_deleted_at IS NULL AND source_site<>'用户手动录入' AND id NOT LIKE 'custom-%' GROUP BY json_extract(catalog_projection,'$.schoolName') LIMIT 1001").all<{name:string;low:number;high:number;source:number}>();
  if(result.results.length>1000)throw new ApiError(503,'NOTICE_ORDER_REBUILD_REQUIRED');
  const schools=result.results.map(r=>({name:r.name,rank:r.low})).sort((a,b)=>compare(a.name,b.name));
  if(result.results.some(r=>!Number.isFinite(r.low)||r.low!==r.high||!Number.isFinite(r.source))||schools.some((s,i)=>i>0&&s.rank<=schools[i-1].rank))throw new ApiError(503,'NOTICE_ORDER_REBUILD_REQUIRED');
  let nextSource=Math.max(-1,...result.results.map(r=>r.source))+1;
  for(const c of needing){
   const name=String(c.after.school_name||'');let school=schools.find(s=>s.name===name);
   if(!school){const index=schools.findIndex(s=>compare(name,s.name)<0),at=index<0?schools.length:index;const left=at?schools[at-1].rank:undefined,right=schools[at]?.rank;
    const rank=left===undefined?(right===undefined?0:right-1):right===undefined?left+1:(left+right)/2;
    if(!Number.isFinite(rank)||rank===left||rank===right)throw new ApiError(503,'NOTICE_ORDER_REBUILD_REQUIRED');school={name,rank};schools.splice(at,0,school);
   }
   orders.set(String(c.after.id),{sourceRank:previous(c.before)?.sourceRank??nextSource++,schoolRank:school.rank});
  }
 }
 const guard='notice-order:'+crypto.randomUUID();
 // A single guarded statement keeps a six-row moderator batch below Free's
 // 50-query bound. JSON values remain bound parameters, never SQL or log text.
 const keys=[...new Set(changes.flatMap(c=>Object.keys(c.before||{})))];
 if(keys.length>95||keys.some(k=>!/^\w+$/.test(k)))throw new ApiError(503,'NOTICE_CAS_FIELD_BOUND');
 const rows=JSON.stringify(changes.map(c=>({id:c.after.id,before:c.before})));
 if(new TextEncoder().encode(rows).length>1500000)throw new ApiError(413,'NOTICE_CAS_SIZE_BOUND');
 const balanced=(terms:string[]):string=>terms.length<2?(terms[0]||'1'):'('+balanced(terms.slice(0,Math.floor(terms.length/2)))+' AND '+balanced(terms.slice(Math.floor(terms.length/2)))+')';
 const same=balanced(keys.map(k=>'n."'+k+'" IS json_extract(c.value,\'$.before.'+k+'\')'));
 const rowCondition=rowsGuarded?'':" AND NOT EXISTS(SELECT 1 FROM json_each(?) c WHERE NOT ((json_type(c.value,'$.before')='null' AND NOT EXISTS(SELECT 1 FROM main__notices n WHERE n.id=json_extract(c.value,'$.id'))) OR (json_type(c.value,'$.before')='object' AND EXISTS(SELECT 1 FROM main__notices n WHERE n.id=json_extract(c.value,'$.id') AND "+same+'))))';
 const begin=[db.prepare("INSERT INTO _business_transaction_guards(id,valid) VALUES(?,CASE WHEN (SELECT value FROM _runtime_state WHERE key='notice_version') IS ?"+rowCondition+' THEN 1 ELSE 0 END)').bind(guard,version,...(rowsGuarded?[]:[rows]))];
 const end=[db.prepare('DELETE FROM _business_transaction_guards WHERE id=?').bind(guard)];
 return{orders,begin,end};
}
