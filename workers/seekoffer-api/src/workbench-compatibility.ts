import {ApiError} from './auth.ts';
type Item=Record<string,unknown>&{id:string};
function records(value:unknown):Item[]{
 if(!Array.isArray(value))throw new ApiError(503,'WORKBENCH_STATE_INVALID');
 const ids=new Set<string>();
 return value.map(item=>{if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.id!=='string'||!item.id||ids.has(item.id))throw new ApiError(400,'WORKBENCH_ITEM_INVALID');ids.add(item.id);return item as Item;});
}
export function preserveWorkbenchFields(previous:Record<string,unknown>,body:Record<string,unknown>,now:string){
 const completed=new Set(Array.isArray(body.completed_todo_ids)?body.completed_todo_ids:[]);
 for(const key of ['custom_todos','mentor_contacts']){
  const remote=records(previous[key]),incoming=records(body[key]),byId=new Map(remote.map(item=>[item.id,item]));
  const merged=incoming.map(item=>{
   const before=byId.get(item.id);byId.delete(item.id);
   // A removed record cannot be revived by an older client or a future clock.
   if(before?.deletedAt)return before;
   const next={...before,...item};
   if(key==='custom_todos'){
    // These original optional fields use omission to clear; retain that contract.
    for(const field of ['date','type','note'])if(!(field in item))delete next[field];
    next.completed=completed.has(item.id);
   }
   return next;
  });
  // Old clients delete by removing an array element. Keep a private tombstone
  // so their cached copies cannot later recreate it during synchronization.
  for(const before of byId.values())merged.push(before.deletedAt?before:{...before,deletedAt:now,updatedAt:now});
  body[key]=merged;
 }
 const deleted=new Set((body.custom_todos as Item[]).filter(item=>item.deletedAt).map(item=>item.id));
 body.completed_todo_ids=[...completed].filter(id=>!deleted.has(String(id)));
 if(new TextEncoder().encode(JSON.stringify(body)).byteLength>512000)throw new ApiError(413,'WORKBENCH_STATE_TOO_LARGE');
 return body;
}
export async function protectWorkbenchUpdate(db:D1Database,owner:string,expected:number,body:Record<string,unknown>){
 if(expected===0)return;
 const row=await db.prepare('SELECT custom_todos,mentor_contacts,sync_revision FROM main__workbench_states WHERE user_id=?').bind(owner).first<{custom_todos:string;mentor_contacts:string;sync_revision:number}>();
 if(!row||row.sync_revision!==expected)throw new ApiError(409,'REVISION_CONFLICT');
 let previous;try{previous={custom_todos:JSON.parse(row.custom_todos),mentor_contacts:JSON.parse(row.mentor_contacts)};}catch{throw new ApiError(503,'WORKBENCH_STATE_INVALID');}
 preserveWorkbenchFields(previous,body,new Date().toISOString());
}
