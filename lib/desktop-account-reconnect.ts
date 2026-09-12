import {confirmD1UserSession,getUserSession} from './user-session';
import {prepareExplicitD1SignInRetry,D1SessionChangedError} from './clerk-d1-session';
import {isD1Backend} from './backend-mode';

const flights=new Map<string,Promise<void>>();
// A temporary startup failure leaves the local journal intact but does not
// establish the in-memory UUID binding. Explicit Sync must revalidate it first.
export function reconnectDesktopAccount(owner:string):Promise<void>{
 if(!isD1Backend())return Promise.resolve();
 if(!owner||getUserSession()?.userId!==owner)return Promise.reject(new D1SessionChangedError());
 const pending=flights.get(owner);if(pending)return pending;
 const task=Promise.resolve().then(async()=>{
  prepareExplicitD1SignInRetry();const session=await confirmD1UserSession();
  if(session.userId!==owner||getUserSession()?.userId!==owner)throw new D1SessionChangedError();
 }).finally(()=>{if(flights.get(owner)===task)flights.delete(owner);});
 flights.set(owner,task);return task;
}
