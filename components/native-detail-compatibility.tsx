'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
export function NativeDetailCompatibility({id}:{id:string}){const router=useRouter();useEffect(()=>{const params=new URLSearchParams({id});const back=new URLSearchParams(window.location.search).get('returnTo');if(back?.startsWith('/notices')&&!back.startsWith('//'))params.set('returnTo',back);router.replace('/notices/detail/?'+params);},[id,router]);return <p className="p-8 text-slate-600">正在读取通知详情…</p>;}
