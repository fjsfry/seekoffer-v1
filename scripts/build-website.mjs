import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import path from 'node:path';
const recovery=process.env.NEXT_PUBLIC_WEBSITE_RECOVERY==='true';
if(recovery){
 if(process.env.NEXT_PUBLIC_BACKEND_PROVIDER!=='d1')throw Error('WEBSITE_RECOVERY_REQUIRES_D1');
 const m=JSON.parse(fs.readFileSync('data/recovery-public/manifest.json','utf8')),bytes=fs.readFileSync('data/recovery-public/catalog.json');
 if(m.sourceRef!=='mnotoltpythkayguhnrk'||m.publicWhitelistOnly!==true||crypto.createHash('sha256').update(bytes).digest('hex')!==m.catalogSha256||JSON.parse(bytes).length!==m.count)throw Error('RECOVERY_PUBLIC_MANIFEST_INVALID');
 console.log(JSON.stringify({stage:'RECOVERY_PUBLIC_SOURCE_VERIFIED',count:m.count,observedAt:m.observedAt,productionDataSync:false}));
}else{const result=spawnSync(process.execPath,['scripts/sync-public-notice-data.mjs'],{stdio:'inherit'});if(result.status)process.exit(result.status);}
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1'};
if(recovery)env.SEEKOFFER_OFFLINE_BUILD='true';
if(recovery)env.NODE_OPTIONS=[env.NODE_OPTIONS||'','--require "'+path.resolve('scripts/emergency-network-guard.cjs').replaceAll('\\','/')+'"'].join(' ').trim();
const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{env,stdio:'inherit'});process.exitCode=result.status??1;
