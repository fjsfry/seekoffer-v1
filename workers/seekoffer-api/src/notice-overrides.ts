import {ApiError} from './auth.ts';
import {createNoticeProjection} from './notice-projection.ts';
import {NOTICE_DETAIL_COLUMNS,mapNoticeRowToProject} from '../../../lib/notice-record';
import {publicVisibility} from './notice-sql.ts';
export {readNoticeOverrides, readNoticeVersion} from './notice-override-reader.ts';
const prefix='notice_override:';
function normalized(row:Record<string,unknown>){const copy={...row};for(const key of ['tags','materials_required','change_log','history_records'])if(typeof copy[key]==='string'){try{copy[key]=JSON.parse(copy[key] as string);}catch{throw new ApiError(503,'NOTICE_SOURCE_INVALID');}}copy.is_verified=Boolean(copy.is_verified);return copy;}
export function overrideStatements(db:D1Database,before:Record<string,unknown>|null,after:Record<string,unknown>,crawler=false,order?:{sourceRank:number;schoolRank:number}){
 const visible=after.admin_status==='published'&&!after.is_private&&!after.admin_deleted_at;
 const wasVisible=before?.admin_status==='published'&&!before?.is_private&&!before?.admin_deleted_at;
 const id=String(after.id);if(visible&&(after.source_site==='用户手动录入'||id.startsWith('custom-')))throw new ApiError(403,'PRIVATE_PROJECT_CANNOT_BE_PUBLISHED');
 if(visible&&!order)throw new ApiError(503,'NOTICE_ORDER_REQUIRED');
 const projection=visible?createNoticeProjection(normalized(after),order!.sourceRank,order!.schoolRank):null;
 if(visible&&!projection)throw new ApiError(400,'NOTICE_NOT_ELIGIBLE_FOR_PUBLIC_CATALOG');
 const statements:D1PreparedStatement[]=[];
 if(visible||wasVisible)statements.push(db.prepare('INSERT INTO _runtime_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(prefix+id,JSON.stringify(visible?{id,visible:true,summary:projection!.summary}:{id,visible:false})));
 else statements.push(db.prepare('UPDATE _runtime_state SET value=? WHERE key=?').bind(JSON.stringify({id,visible:false}),prefix+id));
 statements.push(db.prepare('UPDATE main__notices SET catalog_projection=? WHERE id=?').bind(projection?JSON.stringify(projection):null,id));
 statements.push(db.prepare("INSERT INTO _runtime_state(key,value) VALUES('notice_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(crypto.randomUUID()));
 // Moderator changes revoke every previous public snapshot. Crawler updates
 // never republish or hide managed records. Paged readers reject changed versions
 // and restart instead of mixing records from different ingestion batches.
 if(!crawler)statements.push(db.prepare("INSERT INTO _runtime_state(key,value) VALUES('notice_visibility_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(crypto.randomUUID()));
 return statements;
}
export async function readOverrideDetail(db:D1Database,id:string){
 if(!id||id.length>180)throw new ApiError(400,'INVALID_ID');const row=await db.prepare('SELECT '+NOTICE_DETAIL_COLUMNS+' FROM main__notices n WHERE n.id=? AND '+publicVisibility+" AND n.source_site<>'用户手动录入' AND n.id NOT LIKE 'custom-%'").bind(id).first<Record<string,unknown>>();if(!row)throw new ApiError(404,'NOTICE_UNAVAILABLE');return mapNoticeRowToProject(normalized(row));
}
