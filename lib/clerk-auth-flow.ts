'use client';
import {loadClerkBrowser,type ClerkBrowser} from './clerk-d1-session';
import {confirmD1UserSession,type UserSession} from './user-session';
type Attempt={status:string;createdSessionId?:string|null;supportedFirstFactors?:Factor[];supportedSecondFactors?:Factor[]};
type Factor={strategy:string;emailAddressId?:string};
type SignIn={create(input:Record<string,unknown>):Promise<Attempt>;prepareFirstFactor(input:Record<string,unknown>):Promise<Attempt>;attemptFirstFactor(input:Record<string,unknown>):Promise<Attempt>;prepareSecondFactor(input:Record<string,unknown>):Promise<Attempt>;attemptSecondFactor(input:Record<string,unknown>):Promise<Attempt>};
type SignUp={create(input:Record<string,unknown>):Promise<Attempt>;prepareEmailAddressVerification(input:Record<string,unknown>):Promise<unknown>;attemptEmailAddressVerification(input:Record<string,unknown>):Promise<Attempt>};
export type AuthClerk=ClerkBrowser&{client:{signIn:SignIn;signUp:SignUp};setActive(input:{session:string}):Promise<unknown>};
export type AuthChallenge={kind:'email'|'device'|'signup'|'reset';email:string};
export type AuthFlowResult={status:'signed_in';session:UserSession}|{status:'challenge';challenge:AuthChallenge};
export function createClerkAuthFlow(getSdk:()=>Promise<AuthClerk>,confirm:()=>Promise<UserSession>){
 let pending=false,challenge:AuthChallenge|null=null,factor:Factor|null=null;
 async function locked<T>(work:()=>Promise<T>){if(pending)throw Error('正在处理上一个登录请求，请稍等。');pending=true;try{return await work();}finally{pending=false;}}
 async function finish(sdk:AuthClerk,result:Attempt,email:string):Promise<AuthFlowResult>{
  if(result.status==='needs_second_factor'){
   factor=result.supportedSecondFactors?.find(f=>f.strategy==='email_code')||null;
   if(!factor?.emailAddressId)throw Error('账号还需要额外安全验证，当前验证方式暂未支持，请联系支持。');
   await sdk.client.signIn.prepareSecondFactor({strategy:'email_code',emailAddressId:factor.emailAddressId});
   challenge={kind:'device',email};return{status:'challenge',challenge};
  }
  if(result.status!=='complete'||!result.createdSessionId)throw Error('登录验证尚未完成，请按页面提示继续，当前未登录。');
  await sdk.setActive({session:result.createdSessionId});
  if(sdk.session?.id!==result.createdSessionId)throw Error('登录会话尚未激活，请保留页面后重试。');
  const session=await confirm();
  if(sdk.session?.id!==result.createdSessionId)throw Error('账号已切换，请重新确认当前登录账号。');
  if(!session?.loggedIn||!session.userId)throw Error('主站账号同步未完成，当前不能确认登录成功。');
  challenge=null;factor=null;return{status:'signed_in',session};
 }
 return {
  resume:(email?:string)=>locked(async()=>{const sdk=await getSdk();if(!sdk.session)throw Error('请先输入邮箱和密码完成认证。');if(email&&sdk.user?.primaryEmailAddress?.emailAddress?.toLowerCase()!==email.trim().toLowerCase())throw Error('当前认证会话属于另一个邮箱，请核对显示的当前账号。');const activeId=sdk.session.id,session=await confirm();if(sdk.session?.id!==activeId)throw Error('账号已切换，请重新确认当前登录账号。');return{status:'signed_in',session} as AuthFlowResult;}),
  password:(email:string,password:string)=>locked(async()=>{challenge=null;const sdk=await getSdk();return finish(sdk,await sdk.client.signIn.create({identifier:email,password}),email);}),
  emailCode:(email:string)=>locked(async()=>{challenge=null;const sdk=await getSdk(),attempt=await sdk.client.signIn.create({identifier:email});factor=attempt.supportedFirstFactors?.find(f=>f.strategy==='email_code')||null;if(!factor?.emailAddressId)throw Error('此账号暂不支持邮箱验证码登录，请使用密码登录。');await sdk.client.signIn.prepareFirstFactor({strategy:'email_code',emailAddressId:factor.emailAddressId});challenge={kind:'email',email};return{status:'challenge',challenge} as AuthFlowResult;}),
  signUp:(email:string,password:string)=>locked(async()=>{challenge=null;if(password.length<15)throw Error('新密码至少需要15个字符。');const sdk=await getSdk(),attempt=await sdk.client.signUp.create({emailAddress:email,password});if(attempt.status==='complete')return finish(sdk,attempt,email);await sdk.client.signUp.prepareEmailAddressVerification({strategy:'email_code'});challenge={kind:'signup',email};return{status:'challenge',challenge} as AuthFlowResult;}),
  resetPassword:(email:string)=>locked(async()=>{challenge=null;const sdk=await getSdk();await sdk.client.signIn.create({strategy:'reset_password_email_code',identifier:email});challenge={kind:'reset',email};return{status:'challenge',challenge} as AuthFlowResult;}),
  verify:(email:string,code:string,newPassword?:string)=>locked(async()=>{
   if(!challenge||challenge.email!==email)throw Error('验证步骤已变更，请重新发起当前账号的登录。');if(!/^\d{6}$/.test(code))throw Error('请输入6位邮箱验证码。');
   const sdk=await getSdk();let result:Attempt;
   if(challenge.kind==='signup')result=await sdk.client.signUp.attemptEmailAddressVerification({code});
   else if(challenge.kind==='device')result=await sdk.client.signIn.attemptSecondFactor({strategy:'email_code',code});
   else if(challenge.kind==='reset'){if(!newPassword||newPassword.length<15)throw Error('新密码至少需要15个字符。');result=await sdk.client.signIn.attemptFirstFactor({strategy:'reset_password_email_code',code,password:newPassword});}
   else result=await sdk.client.signIn.attemptFirstFactor({strategy:'email_code',code});
   return finish(sdk,result,email);
  }),
  resend:(email:string)=>locked(async()=>{
   if(!challenge||challenge.email!==email)throw Error('验证步骤已变更，请重新开始。');const sdk=await getSdk();
   if(challenge.kind==='signup')await sdk.client.signUp.prepareEmailAddressVerification({strategy:'email_code'});
   else if(challenge.kind==='device')await sdk.client.signIn.prepareSecondFactor({strategy:'email_code',emailAddressId:factor?.emailAddressId});
   else if(challenge.kind==='reset')await sdk.client.signIn.create({strategy:'reset_password_email_code',identifier:email});
   else await sdk.client.signIn.prepareFirstFactor({strategy:'email_code',emailAddressId:factor?.emailAddressId});
   return{status:'challenge',challenge} as AuthFlowResult;
  }),
  cancel(){if(pending)return false;challenge=null;factor=null;return true;}
 };
}
export function clerkFlowError(error:unknown){
 const code=(error as {errors?:{code?:string}[]})?.errors?.[0]?.code;
 const messages:Record<string,string>={form_password_incorrect:'邮箱或密码不正确，请重新核对。',form_identifier_not_found:'该邮箱暂未找到账号，请核对邮箱或注册。',form_code_incorrect:'验证码不正确，请使用最新邮件中的验证码。',verification_expired:'验证码已过期，请重新发送。',form_password_pwned:'该密码存在泄露风险，请使用邮箱验证码登录并重设密码。',form_password_length_too_short:'新密码至少需要15个字符。',form_identifier_exists:'这个邮箱已经注册，请直接登录。',not_allowed_access:'当前注册仍限受邀用户，已有账号可正常登录。',sign_up_restricted:'当前注册仍限受邀用户，已有账号可正常登录。',too_many_requests:'请求过于频繁，请稍等后再试。',captcha_invalid:'请完成页面上的安全验证后再试。'};
 if(code)return messages[code]||'认证步骤未完成，请核对输入或稍后再试。';
 return error instanceof Error?error.message:'登录未完成，请保留当前页面后重试。';
}
export const clerkAuthFlow=createClerkAuthFlow(async()=>{
 const sdk=await loadClerkBrowser() as AuthClerk;if(!sdk.client?.signIn?.create||!sdk.setActive)throw Error('登录组件尚未准备好，请稍后重试。');return sdk;
},confirmD1UserSession);
