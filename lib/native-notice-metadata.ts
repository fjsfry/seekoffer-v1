import type {PublicNoticeSearchResponse} from './public-notice-search';

type Page = PublicNoticeSearchResponse & {metadataVersion?:string};
type Part = {section:string;version:string;expiresAt:number;servedAt:string;stats?:Page['stats'];sideData?:Omit<Page['sideData'],'topColleges'>;facets?:Omit<Page['facets'],'collegeStats'>;collegeStats?:Page['facets']['collegeStats'];topColleges?:Page['sideData']['topColleges']};

// The native client consumes the same versioned contract as the website.
// Only small public metadata is reused; no private records or full catalog.
export function createNativeNoticeMetadata(read:(path:string)=>Promise<unknown>,now=()=>performance.now()) {
 const cache=new Map<string,{value:Part;until:number}>();
 const flights=new Map<string,Promise<Part>>();
 const aborted=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};
 return async(data:Page,filters:URLSearchParams,signal?:AbortSignal):Promise<Page>=>{
  aborted(signal);const version=data.metadataVersion;if(!version)return data;
  if(typeof version!=='string'||version.length>100)throw Error('通知版本无效，请重新加载。');
  const values=await Promise.all(['summary','facets','colleges'].map(async section=>{
   const query=new URLSearchParams({section,version});if(section==='facets')for(const key of ['category','region'])if(filters.has(key))query.set(key,filters.get(key)!);
   const key=query.toString(),known=cache.get(key);if(known&&known.until>now())return known.value;
   let flight=flights.get(key);
   if(!flight){flight=(async()=>{
    const value=await read('/api/public/notices/metadata/?'+key) as Part;
    if(!value||value.section!==section||value.version!==version||!Number.isFinite(value.expiresAt)||!Number.isFinite(Date.parse(value.servedAt))||value.expiresAt<=Date.parse(value.servedAt))throw Error('通知更新版本已变化，请重新加载。');
    if(cache.size>=18)cache.clear();cache.set(key,{value,until:now()+Math.max(0,Math.min(60000,value.expiresAt-Date.parse(value.servedAt)-5000))});return value;
   })();flights.set(key,flight);}
   try{return await flight;}finally{if(flights.get(key)===flight)flights.delete(key);}
  }));
  aborted(signal);const [summary,facets,colleges]=values;
  if(!summary.stats||!summary.sideData||!facets.facets||!Array.isArray(colleges.collegeStats)||!Array.isArray(colleges.topColleges))throw Error('通知筛选信息暂未完整加载，请重试。');
  return {...data,stats:summary.stats,sideData:{...summary.sideData,topColleges:colleges.topColleges},facets:{...facets.facets,collegeStats:colleges.collegeStats}};
 };
}
