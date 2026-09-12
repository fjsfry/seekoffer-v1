// Private workspace labels only, never a public notice fallback or detail cache.
export type ApplicationNoticeLabel={schoolName:string;departmentName:string;projectName:string;verifiedAt:string};
type Store=Pick<Storage,'getItem'|'setItem'>;
const key=(owner:string)=>'seekoffer-d1-application-labels-v1:'+owner;
export function readApplicationNoticeLabels(storage:Store,owner:string):Record<string,ApplicationNoticeLabel>{
 try{const raw=storage.getItem(key(owner));if(!raw||raw.length>2000000)return{};const value=JSON.parse(raw);if(value.owner!==owner||value.version!==1||!value.labels||Array.isArray(value.labels))return{};
  return Object.fromEntries(Object.entries(value.labels).filter(([id,label])=>{const v=label as ApplicationNoticeLabel;return id.length<=180&&v&&typeof v.schoolName==='string'&&v.schoolName.length<=500&&typeof v.departmentName==='string'&&v.departmentName.length<=1000&&typeof v.projectName==='string'&&v.projectName.length<=2000&&Number.isFinite(Date.parse(v.verifiedAt));})) as Record<string,ApplicationNoticeLabel>;
 }catch{return{};}
}
export function rememberApplicationNoticeLabels(storage:Store,owner:string,ids:string[],items:Record<string,unknown>[],unavailableIds:string[]){
 const allowed=new Set(ids),unavailable=new Set(unavailableIds),labels=readApplicationNoticeLabels(storage,owner);
 for(const id of Object.keys(labels))if(!allowed.has(id)||unavailable.has(id))delete labels[id];
 for(const row of items){const id=String(row.id);if(!allowed.has(id)||unavailable.has(id))continue;
  if(typeof row.schoolName!=='string'||row.schoolName.length>500||typeof row.departmentName!=='string'||row.departmentName.length>1000||typeof row.projectName!=='string'||row.projectName.length>2000)continue;
  labels[id]={schoolName:row.schoolName,departmentName:row.departmentName,projectName:row.projectName,verifiedAt:new Date().toISOString()};
 }
 try{const data=JSON.stringify({version:1,owner,labels});if(data.length<=2000000)storage.setItem(key(owner),data);}catch{/* Optional labels must not invalidate a successfully synchronized journal. */}
 return labels;
}
