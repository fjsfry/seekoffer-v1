// Local inspection only. A candidate is not a cloud import or a confirmed save.
// Callers must verify the current D1 owner before presenting matched records.
type StorageReader = Pick<Storage, 'getItem'>;
const baseKey = 'seekoffer-my-application-table';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const fields = new Set(['userProjectId','userId','projectId','isFavorited','myStatus','priorityLevel','materialsProgress','cvReady','transcriptReady','rankingProofReady','recommendationReady','personalStatementReady','contactSupervisorDone','submittedAt','interviewTime','resultStatus','myNotes','customReminderEnabled']);
export type LegacyApplicationCandidate = {storageKey:string;index:number;record:Record<string,string|number|boolean>};

export function inspectLegacyApplications(storage:StorageReader, owner:string) {
  if(!uuid.test(owner)) throw new Error('请先核实当前账号，再检查旧版记录。');
  const candidates:LegacyApplicationCandidate[]=[];
  let unassignedCount=0, foreignAccountCount=0, invalidCount=0;
  const unreadableKeys:string[]=[];
  // Both generations exist in the repository: original global storage and
  // account-scoped desktop/web storage, followed by the D1 recovery keys.
  for(const storageKey of [baseKey,`${baseKey}:${owner}`,`${baseKey}:local`,`${baseKey}:anonymous`,`${baseKey}:d1:${owner}`,`${baseKey}:d1:guest`]) {
    let raw:string|null;
    try { raw=storage.getItem(storageKey); } catch { unreadableKeys.push(storageKey);continue; }
    if(raw===null)continue;
    let items:unknown[];
    let containerOwner:unknown;
    try {
      const parsed:unknown=JSON.parse(raw);
      items=Array.isArray(parsed)?parsed:(parsed&&typeof parsed==='object'&&'items'in parsed&&Array.isArray(parsed.items)?parsed.items:[]);
      if(!Array.isArray(parsed)&&!(parsed&&typeof parsed==='object'&&'items'in parsed&&Array.isArray(parsed.items)))throw new Error('INVALID_CONTAINER');
      if(!Array.isArray(parsed)&&parsed&&typeof parsed==='object'&&'owner'in parsed)containerOwner=parsed.owner;
    }catch { unreadableKeys.push(storageKey);continue; }
    if(containerOwner!==undefined&&containerOwner!==null){
      if(typeof containerOwner!=='object'||Array.isArray(containerOwner)||!('kind'in containerOwner)){unreadableKeys.push(storageKey);continue;}
      if(containerOwner.kind==='local'||containerOwner.kind==='anonymous'){unassignedCount+=items.length;continue;}
      if(containerOwner.kind!=='member'||!('userId'in containerOwner)||typeof containerOwner.userId!=='string'||!uuid.test(containerOwner.userId)){unreadableKeys.push(storageKey);continue;}
      if(containerOwner.userId.toLowerCase()!==owner.toLowerCase()){foreignAccountCount+=items.length;continue;}
    }
    if([`${baseKey}:local`,`${baseKey}:anonymous`,`${baseKey}:d1:guest`].includes(storageKey)){unassignedCount+=items.length;continue;}
    items.forEach((value,index)=>{
      if(!value||typeof value!=='object'||Array.isArray(value)){invalidCount++;return;}
      const row=value as Record<string,unknown>;
      if(typeof row.userId!=='string'||!uuid.test(row.userId)){unassignedCount++;return;}
      if(row.userId.toLowerCase()!==owner.toLowerCase()){foreignAccountCount++;return;}
      if(typeof row.userProjectId!=='string'||!row.userProjectId||typeof row.projectId!=='string'||!row.projectId||
        Object.entries(row).some(([key,v])=>!fields.has(key)||!['string','number','boolean'].includes(typeof v)||(typeof v==='number'&&!Number.isFinite(v)))){
        invalidCount++;return;
      }
      // No truncation, normalization, de-duplication, deletion, or silent ownership reassignment.
      candidates.push({storageKey,index,record:{...row} as LegacyApplicationCandidate['record']});
    });
  }
  return {candidates,unassignedCount,foreignAccountCount,invalidCount,unreadableKeys};
}

export function inspectLegacyWorkbenchStorage(storage:StorageReader,owner:string){
  if(!uuid.test(owner))throw new Error('请先核实当前账号。');
  return [
    {label:'日程与待办',key:'seekoffer-workbench-custom-todos'},
    {label:'待办完成标记',key:'seekoffer-workbench-completed-todos'},
    {label:'导师联系人',key:'seekoffer-workbench-mentor-contacts'}
  ].map(({label,key})=>{
    let ownedCount=0,unassignedCount=0,invalidCount=0;
    // Only the verified previous account namespace and the unscoped legacy
    // namespace. Never enumerate other users or copy a legacy value on read.
    for(const suffix of [`:owner:${owner}`,'']){
      try{const raw=storage.getItem(key+suffix);if(raw===null)continue;const parsed:unknown=JSON.parse(raw);if(!Array.isArray(parsed)){invalidCount++;continue;}if(suffix)ownedCount+=parsed.length;else unassignedCount+=parsed.length;}
      catch{invalidCount++;}
    }
    return {label,ownedCount,unassignedCount,invalidCount};
  });
}
