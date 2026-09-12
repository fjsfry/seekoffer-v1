// No timer and no background retry. The next user request may probe after the
// daily reset; an explicit account retry is limited to one per minute.
export function createQuotaCircuit(now:()=>number=Date.now){
 let until=0,lastProbe=0;
 return {
  blocked(){return now()<until;},
  restrict(){const at=now();until=(Math.floor(at/86400000)+1)*86400000;lastProbe=at;},
  retryExplicitly(){if(!this.blocked())return true;if(now()-lastProbe<60000)return false;lastProbe=now();until=0;return true;}
 };
}
