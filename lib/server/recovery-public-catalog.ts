import 'server-only';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {cache} from 'react';
import {noticeListItemToProject,type NoticeListItem} from '../notice-record';
import type {PublicNoticeProject} from '../mock-data';
import {ServiceUnavailableError} from '../service-availability';
import {getRecoveryOverrides,getUpdatedRecoveryDetail} from './recovery-notice-overrides';
const root=join(process.cwd(),'data','recovery-public');
type Catalog={items:PublicNoticeProject[];source:'recovery';version:string;observedAt:string};
let immutable:Catalog|undefined;
let lastLive:Catalog|undefined;
function frozenCatalog(items:PublicNoticeProject[]){Object.freeze(items);return items;}
function immutablePublicSummary(item:NoticeListItem){const project=noticeListItemToProject(item);Object.freeze(project.tags);return Object.freeze(project);}
export function getRecoveryCatalog():Catalog{
 if(immutable)return immutable;
 const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));
 const bytes=readFileSync(join(root,'catalog.json'));
 if(manifest.sourceRef!=='mnotoltpythkayguhnrk'||manifest.publicWhitelistOnly!==true||createHash('sha256').update(bytes).digest('hex')!==manifest.catalogSha256)throw new ServiceUnavailableError(503,'RECOVERY_DATA_VALIDATION_FAILED');
 const items=JSON.parse(bytes.toString('utf8')) as NoticeListItem[];
 if(!Array.isArray(items)||items.length!==manifest.count||new Set(items.map(i=>i.id)).size!==items.length)throw new ServiceUnavailableError(503,'RECOVERY_DATA_INCOMPLETE');
 immutable={items:frozenCatalog(items.map(immutablePublicSummary)),source:'recovery',version:manifest.version,observedAt:manifest.observedAt};return immutable;
}
export async function getLiveRecoveryCatalog():Promise<Catalog>{const base=getRecoveryCatalog(),changes=await getRecoveryOverrides(),version=base.version+':'+changes.version;if(lastLive?.version===version)return lastLive;const items=new Map(base.items.map(i=>[i.id,i]));for(const change of changes.items){if(change.visible)items.set(change.id,immutablePublicSummary(change.summary!));else items.delete(change.id);}lastLive={...base,items:frozenCatalog([...items.values()]),version};return lastLive;}
const bundledDetail=cache((id:string):PublicNoticeProject|null=>{
 if(!id||id.length>180||/[\u0000-\u001f]/.test(id))throw new ServiceUnavailableError(400,'INVALID_NOTICE_ID');
 const file=createHash('sha256').update(id).digest('hex')+'.json';
 try{const row=JSON.parse(readFileSync(join(root,'details',file),'utf8')) as PublicNoticeProject;if(row.id!==id)throw new ServiceUnavailableError(503,'RECOVERY_DETAIL_ID_MISMATCH');return row;}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
});
export const getRecoveryDetail=cache(async(id:string):Promise<PublicNoticeProject|null>=>{const changes=await getRecoveryOverrides(),item=changes.items.find(i=>i.id===id);if(item)return item.visible?getUpdatedRecoveryDetail(id):null;return bundledDetail(id);});
