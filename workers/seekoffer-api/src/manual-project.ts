import {ApiError} from './auth.ts';
const projectTypes=new Set(['夏令营','预推免','正式推免','宣讲会','入营名单','推免','九推']);
const fields=['schoolName','departmentName','projectName','projectType','discipline','deadlineDate','eventStartDate','eventEndDate','applyLink'];
function text(value:unknown,max:number,required=false){if(value===undefined&&!required)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u001f]/.test(value))throw new ApiError(400,'INVALID_MANUAL_TEXT');const result=value.trim();if(required&&!result)throw new ApiError(400,'MANUAL_REQUIRED_FIELD');return result;}
function date(value:unknown){const result=text(value,10);if(!result)return '';const stamp=Date.parse(result+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(result)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==result)throw new ApiError(400,'INVALID_MANUAL_DATE');return result;}
export async function createManualProject(db:D1Database,owner:string,body:Record<string,unknown>){
 if(Object.keys(body).some(k=>!['requestId','project'].includes(k))||typeof body.requestId!=='string'||!/^([0-9a-f]{8}-)([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.requestId)||!body.project||Array.isArray(body.project)||typeof body.project!=='object')throw new ApiError(400,'INVALID_MANUAL_REQUEST');
 const input=body.project as Record<string,unknown>;if(Object.keys(input).some(k=>!fields.includes(k)))throw new ApiError(400,'UNSUPPORTED_FIELD');
 const type=text(input.projectType,20,true);if(!projectTypes.has(type))throw new ApiError(400,'INVALID_PROJECT_TYPE');
 const link=text(input.applyLink,2000);if(link){let parsed;try{parsed=new URL(link);}catch{throw new ApiError(400,'INVALID_APPLICATION_LINK');}if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new ApiError(400,'INVALID_APPLICATION_LINK');}
 const row:Record<string,string|number>={school_name:text(input.schoolName,200,true),department_name:text(input.departmentName,200)||'待补充',project_name:text(input.projectName,300,true),project_type:type,discipline:text(input.discipline,200)||'待补充',deadline_date:date(input.deadlineDate),event_start_date:date(input.eventStartDate),event_end_date:date(input.eventEndDate),apply_link:link,source_link:link,is_private:1,created_by:owner};
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner+'\n'+body.requestId.toLowerCase()));
 const id='custom-'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const columns=Object.keys(row);const old=await db.prepare('SELECT '+columns.join(',')+',admin_deleted_at FROM main__notices WHERE id=?').bind(id).first<Record<string,unknown>>();
 if(old){if(old.admin_deleted_at||columns.some(c=>old[c]!==row[c]))throw new ApiError(409,'MANUAL_REQUEST_CONFLICT');const application=await db.prepare('SELECT id,sync_revision FROM main__applications WHERE user_id=? AND project_id=?').bind(owner,id).first();if(!application)throw new ApiError(409,'MANUAL_APPLICATION_REMOVED');return {projectId:id,application,replayed:true};}
 const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10),created={id,...row,publish_date:today,year:Number(today.slice(0,4)),source_site:'用户手动录入',remarks:'用户手动录入项目',tags:'["手动录入"]',status:row.deadline_date?'报名中':'未开始'};
 const all=Object.keys(created),same=columns.map(c=>'main__notices.'+c+' IS excluded.'+c).join(' AND ');
 try{
  await db.batch([
   db.prepare('INSERT INTO main__notices('+all.join(',')+') VALUES('+all.map(()=>'?').join(',')+') ON CONFLICT(id) DO UPDATE SET id=CASE WHEN '+same+' AND main__notices.admin_deleted_at IS NULL THEN main__notices.id ELSE NULL END').bind(...Object.values(created)),
   db.prepare('INSERT INTO main__applications(id,user_id,project_id) VALUES(?,?,?) ON CONFLICT(user_id,project_id) DO NOTHING').bind(crypto.randomUUID(),owner,id)
  ]);
 }catch(error){if(error instanceof Error&&error.message.includes('NOT NULL constraint failed: main__notices.id'))throw new ApiError(409,'MANUAL_REQUEST_CONFLICT');throw error;}
 const application=await db.prepare('SELECT id,sync_revision FROM main__applications WHERE user_id=? AND project_id=?').bind(owner,id).first();if(!application)throw new ApiError(503,'MANUAL_TRANSACTION_NOT_CONFIRMED');return {projectId:id,application,replayed:false};
}
