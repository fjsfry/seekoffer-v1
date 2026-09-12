'use client';
import {invoke} from '@tauri-apps/api/core';
import type {ClerkBrowser} from './clerk-d1-session';
type NativeSession={accessToken:string;expiresAt:number;subject:string;email:string;sessionId:string};
let snapshot:NativeSession|null=null;const listeners=new Set<()=>void>();
const event='seekoffer-native-auth-changed';
const browser:ClerkBrowser={load:async()=>{},session:null,user:null,addListener(fn){listeners.add(fn);return()=>listeners.delete(fn);},signOut:async()=>{await invoke('native_auth_sign_out');update(null);}};
function update(value:NativeSession|null){
 const old=snapshot?.sessionId;snapshot=value;
 browser.user=value?{id:value.subject,primaryEmailAddress:{emailAddress:value.email}}:null;
 browser.session=value?{id:value.sessionId,getToken:async()=>{const current=await invoke<NativeSession|null>('native_auth_session');if(!current||current.sessionId!==value.sessionId){update(current);throw new Error('账号已切换或登录已过期，请重新登录。');}snapshot=current;return current.accessToken;}}:null;
 if(old!==value?.sessionId){listeners.forEach(fn=>fn());if(typeof window!=='undefined')window.dispatchEvent(new Event(event));}
}
export async function loadNativeClerkBrowser(){update(await invoke<NativeSession|null>('native_auth_session'));return browser;}
export async function startNativeLogin(){try{const value=await invoke<NativeSession>('native_auth_login');update(value);}catch(e){const code=String(e);throw new Error(code==='NATIVE_LOGIN_TIMEOUT'?'登录等待已超时，请重试。':code==='NATIVE_LOGIN_ALREADY_RUNNING'?'系统浏览器中的登录尚未结束，请先完成该窗口。':code==='NATIVE_WINDOW_REJECTED'?'请在已编译的寻鹿桌面端中登录。':'登录尚未完成，请检查浏览器或网络后重试；本机资料仍保留。');}}
export async function nativePublicRequest(path:string,options:{method?:string;body?:unknown}={}){return invoke<unknown>('native_public_request',{path,method:options.method||'GET',body:options.body??null});}
