export function backendKind(value=process.env.NEXT_PUBLIC_BACKEND_PROVIDER):'supabase'|'d1'{
  if(value===undefined||value===''||value==='supabase')return 'supabase';
  if(value==='d1')return 'd1';
  throw new Error('未知后端配置，已停止连接。');
}
export function isD1Backend(){return backendKind()==='d1';}
