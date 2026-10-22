import {prepareFill,consumeFill} from '../src/billing.ts';
// Test-only identity injection. The production Worker verifies Clerk identity
// and resolves its mapped business UUID before calling these functions.
export default {async fetch(request:Request,env:{CORE:D1Database}){
 try{
  const body=await request.json() as Record<string,unknown>;
  const owner=request.headers.get('x-fixture-owner')||'';
  const result=body.action==='prepare-fill-session'
   ?await prepareFill(env.CORE,owner,body)
   :await consumeFill(env.CORE,body,Date.now,owner);
  return Response.json(result);
 }catch(error){return Response.json({error:error instanceof Error?error.message:'test_error'},{status:Number((error as {status?:number}).status)||500});}
}};
