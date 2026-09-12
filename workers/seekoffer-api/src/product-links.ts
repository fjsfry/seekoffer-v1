import {ApiError} from './auth.ts';
const targets=['purchase','homepage','privacy','support'];
export async function productLink(db:D1Database,request:Request,purchasesEnabled:boolean){
 const params=new URL(request.url).searchParams,target=params.get('target')||'purchase';
 if([...params.keys()].some(k=>!['target','format'].includes(k)||params.getAll(k).length!==1)||params.has('format')&&params.get('format')!=='json')throw new ApiError(400,'INVALID_PRODUCT_LINK');
 if(!targets.includes(target))throw new ApiError(404,'UNKNOWN_PRODUCT_LINK');
 const row=await db.prepare('SELECT destination_url,enabled FROM autofill__product_links WHERE key=?').bind(target).first<{destination_url:string;enabled:number}>();
 let destination:string|null=null;
 if(row?.enabled){try{const u=new URL(row.destination_url);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!/\s/.test(row.destination_url)&&row.destination_url.length<=500&&!u.hostname.endsWith('.supabase.co'))destination=u.href;}catch{}}
 const maintenance=target==='purchase'&&!purchasesEnabled;
 return{target,enabled:Boolean(destination)&&!maintenance,destinationUrl:maintenance?null:destination,status:maintenance?'maintenance':destination?'available':'not_configured',message:maintenance?'新购买尚未开放，原订单与权益保留。':destination?'官方链接可用。':'此链接暂不可用，请稍后重试。'};
}
