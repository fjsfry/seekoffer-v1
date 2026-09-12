'use client';
import type {ReactNode} from 'react';
import {isD1Backend} from '@/lib/backend-mode';
export function AuthEntryLink({children,className,onActivate}:{children:ReactNode;className:string;onActivate:()=>void}){
 if(!isD1Backend())return <button type="button" className={className} onClick={onActivate}>{children}</button>;
 return <a href="/auth/sign-in/" className={className} onClick={event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  onActivate();event.preventDefault();
 }}>{children}</a>;
}
