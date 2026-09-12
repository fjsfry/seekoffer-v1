// Only the reviewed public website API is used. No database or account keys.
export async function fetchD1DailyNotices(date, fetcher=fetch) {
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('INVALID_DIGEST_DATE');
  const notices=[],ids=new Set();let version,total;
  for(let page=1;page<=100;page++){
    const url='https://www.seekoffer.com.cn/api/public/notices/?'+new URLSearchParams({date,page:String(page),pageSize:'40',sort:'publish'});
    const r=await fetcher(url,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error('PUBLIC_DIGEST_HTTP_'+r.status);
    const raw=await r.text();if(Buffer.byteLength(raw)>300000)throw Error('PUBLIC_DIGEST_RESPONSE_BOUND');
    const value=JSON.parse(raw),next=r.headers.get('x-notice-version');
    if(!next||!Array.isArray(value.items)||value.items.length>40||!Number.isSafeInteger(value.pagination?.total)||value.pagination.total<0||value.pagination.page!==page)throw Error('PUBLIC_DIGEST_RESPONSE_INVALID');
    if(page===1){version=next;total=value.pagination.total;}else if(version!==next||total!==value.pagination.total)throw Error('PUBLIC_DIGEST_VERSION_CHANGED');
    if(total>4000)throw Error('PUBLIC_DIGEST_EXCEEDS_SAFE_LIMIT');
    for(const item of value.items){
      if(!item.id||ids.has(item.id)||item.publishDate!==date)throw Error('PUBLIC_DIGEST_SCOPE_MISMATCH');
      ids.add(item.id);
      const keys=['id','schoolName','departmentName','projectName','projectType','publishDate','deadlineDate','applyLink','sourceLink'];
      notices.push(Object.fromEntries(keys.filter(k=>typeof item[k]==='string').map(k=>[k,item[k]])));
    }
    if(notices.length===total)return{notices,version,requests:page,source:'public-website-backed-by-D1'};
    if(!value.items.length||notices.length>total)throw Error('PUBLIC_DIGEST_INCOMPLETE');
  }
  throw Error('PUBLIC_DIGEST_EXCEEDS_SAFE_LIMIT');
}
