import {runDailyDigest} from './digest-core.mjs';

// All operational entry points use this runner. Only reviewed configuration is
// forwarded; inherited Supabase/CloudBase/model credentials are never consulted.
export async function invokeD1Digest(event, {env=process.env, fetchImpl=fetch, run=runDailyDigest}={}) {
  const dryRun=event.dryRun===true;
  if(!dryRun && env.SEEKOFFER_DIGEST_PUBLISH_ENABLED!=='true') throw Error('WECHAT_PUBLISH_NOT_ENABLED');
  const config={SEEKOFFER_DIGEST_BACKEND:'d1',OPENAI_API_KEY:''};
  for(const key of ['SEEKOFFER_SITE_URL','WECHAT_DAILY_MAX_CONTENT_CHARS','WECHAT_DAILY_AUTHOR']) {
    if(env[key]) config[key]=env[key];
  }
  if(!dryRun) for(const key of ['WECHAT_MP_APP_ID','WECHAT_MP_APP_SECRET','WECHAT_MP_THUMB_MEDIA_ID','WECHAT_LEDGER_SECRET']) {
    if(env[key]) config[key]=env[key];
  }
  try {return await run({event:{...event,dryRun},env:config,fetchImpl});}
  catch(error) {
    // A provider response or stack may contain request headers. Only known,
    // uppercase local error codes may cross the operational command boundary.
    const code=error instanceof Error && /^[A-Z][A-Z0-9_]{1,100}$/.test(error.message) ? error.message : 'D1_DIGEST_OPERATION_FAILED';
    throw Error(code);
  }
}
