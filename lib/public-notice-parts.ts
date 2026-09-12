import type {PublicNoticeSearchResponse} from './public-notice-search';
import {publicNoticeFetch,ServiceUnavailableError} from './service-availability';
type Part={section:string;version:string;expiresAt:number;servedAt:string;stats?:PublicNoticeSearchResponse['stats'];sideData?:Omit<PublicNoticeSearchResponse['sideData'],'topColleges'>;facets?:Omit<PublicNoticeSearchResponse['facets'],'collegeStats'>;collegeStats?:PublicNoticeSearchResponse['facets']['collegeStats'];topColleges?:PublicNoticeSearchResponse['sideData']['topColleges']};
const parts=new Map<string,{value:Part;until:number}>();
export function clearPublicMetadataParts(){parts.clear();}
export async function mergePublicNoticeParts(data:PublicNoticeSearchResponse&{metadataVersion?:string},filters:URLSearchParams,signal?:AbortSignal){
 const version=data.metadataVersion;if(!version)return data;
 if(typeof version!=='string'||version.length>100)throw new ServiceUnavailableError(503,'INVALID_PUBLIC_METADATA_VERSION');
 const values=await Promise.all(['summary','facets','colleges'].map(async section=>{
  const query=new URLSearchParams({section,version});if(section==='facets')for(const k of ['category','region'])if(filters.has(k))query.set(k,filters.get(k)!);
  const key=query.toString(),known=parts.get(key);if(known&&known.until>performance.now())return known.value;
  const response=await publicNoticeFetch('/api/public/notices/metadata/?'+key,{headers:{Accept:'application/json'},signal});if(!response.ok)throw new ServiceUnavailableError(response.status);
  const value=await response.json() as Part;
  if(value.version!==version||value.section!==section||!Number.isFinite(value.expiresAt)||!Number.isFinite(Date.parse(value.servedAt)))throw new ServiceUnavailableError(503,'PUBLIC_METADATA_VERSION_CHANGED');
  if(parts.size>=18)parts.clear();parts.set(key,{value,until:performance.now()+Math.max(0,Math.min(60000,value.expiresAt-Date.parse(value.servedAt)-5000))});return value;
 }));
 const [summary,facets,colleges]=values;
 if(!summary.stats||!summary.sideData||!facets.facets||!Array.isArray(colleges.collegeStats)||!Array.isArray(colleges.topColleges))throw new ServiceUnavailableError(503,'PUBLIC_METADATA_INCOMPLETE');
 return {...data,stats:summary.stats,sideData:{...summary.sideData,topColleges:colleges.topColleges},facets:{...facets.facets,collegeStats:colleges.collegeStats}} as PublicNoticeSearchResponse;
}
