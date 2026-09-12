import {loadClerkBrowser, D1SessionChangedError, type ClerkBrowser} from './clerk-d1-session';

export type Verification = {status:'needs_first_factor'|'needs_second_factor'|'complete';supportedFirstFactors?:{strategy:string;emailAddressId?:string}[]|null;supportedSecondFactors?:{strategy:string}[]|null};
export type VerificationSession = {
 id:string;getToken(options?:{skipCache?:boolean}):Promise<string|null>;
 startVerification(options:{level:'multi_factor'}):Promise<Verification>;
 prepareFirstFactorVerification(options:{strategy:'email_code';emailAddressId:string}):Promise<Verification>;
 attemptFirstFactorVerification(options:{strategy:'password';password:string}|{strategy:'email_code';code:string}):Promise<Verification>;
 attemptSecondFactorVerification(options:{strategy:'totp'|'backup_code';code:string}):Promise<Verification>;
};

// Credentials remain in the active Clerk request and are never sent to D1 or
// local storage. Each step checks the exact session and user before and after.
export async function startClerkReverification(loader:()=>Promise<ClerkBrowser>=loadClerkBrowser) {
 const clerk=await loader(), current=clerk.session, subject=clerk.user?.id;
 if(!current||!subject)throw new D1SessionChangedError();
 const session=current as typeof current & Partial<VerificationSession>;
 if(!session.startVerification||!session.prepareFirstFactorVerification||!session.attemptFirstFactorVerification||!session.attemptSecondFactorVerification)throw Error('当前认证组件暂不支持安全验证，请刷新页面后重试。');
 const verified=session as VerificationSession;
 const guard=()=>{if(clerk.session?.id!==session.id||clerk.user?.id!==subject)throw new D1SessionChangedError();};
 async function step(run:()=>Promise<Verification>) {
  guard();const value=await run();guard();
  if(value.status==='complete'){const token=await session.getToken({skipCache:true});guard();if(!token)throw new D1SessionChangedError();}
  return value;
 }
 return {initial:await step(()=>verified.startVerification({level:'multi_factor'})),
  email:(id:string)=>step(()=>verified.prepareFirstFactorVerification({strategy:'email_code',emailAddressId:id})),
  password:(password:string)=>step(()=>verified.attemptFirstFactorVerification({strategy:'password',password})),
  code:(strategy:'email_code'|'totp'|'backup_code',code:string)=>step(()=>strategy==='email_code'?verified.attemptFirstFactorVerification({strategy,code}):verified.attemptSecondFactorVerification({strategy,code}))};
}
