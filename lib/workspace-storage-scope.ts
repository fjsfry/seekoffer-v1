import {isD1Backend} from './backend-mode';
import {getUserSession} from './user-session';
export function workspaceStorageKey(base:string,ownerId?:string){
 if(!isD1Backend())return base;
 const owner=ownerId===undefined?getUserSession()?.userId||'':ownerId;
 if(owner&&!/^([0-9a-f]{8}-)([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(owner))throw new Error('本地工作区账号标识无效。');
 return base+':d1:'+(owner||'guest');
}
