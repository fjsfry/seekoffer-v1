'use client';
export function readCommunityDraft<T extends Record<string,string|boolean>>(key:string,fallback:T):T{
 if(typeof window==='undefined'||!key)return fallback;
 try{const value=JSON.parse(localStorage.getItem(key)||'null');if(!value||typeof value!=='object'||Array.isArray(value))return fallback;return Object.fromEntries(Object.entries(fallback).map(([k,v])=>[k,typeof value[k]===typeof v?value[k]:v])) as T;}catch{return fallback;}
}
export function saveCommunityDraft(key:string,value:Record<string,string|boolean>){if(!key||typeof window==='undefined')return;try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
