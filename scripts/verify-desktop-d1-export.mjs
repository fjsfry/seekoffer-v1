import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
export async function verifyDesktopD1Export(directory){
 const root=path.resolve(directory),files=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(/\.(js|html|json|map)$/.test(e.name))files.push(p);}}await walk(root);
 let d1=false,pkce=false,publicCalls=false;const hashes=[];
 for(const p of files){const bytes=await fs.readFile(p),s=bytes.toString('utf8');
  if(/\b(?:sb_secret_|sk_live_|sk_test_)[A-Za-z0-9_-]{16,}/.test(s)||/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(s))throw Error('DESKTOP_SECRET_SCAN_FAILED');
  for(const m of s.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)){try{if(JSON.parse(Buffer.from(m[0].split('.')[1],'base64url').toString()).role==='service_role')throw Error('DESKTOP_SECRET_SCAN_FAILED');}catch(e){if(e.message==='DESKTOP_SECRET_SCAN_FAILED')throw e;}}
  d1 ||= s.includes('https://migration.seekoffer.com.cn');pkce ||= s.includes('native_auth_login');publicCalls ||= s.includes('native_public_request');hashes.push([path.relative(root,p).replaceAll('\\','/'),createHash('sha256').update(bytes).digest('hex')]);
 }
 if(!d1||!pkce||!publicCalls||!files.length)throw Error('DESKTOP_D1_EXPORT_INCOMPLETE');
 return{backend:'d1',authentication:'native-Clerk-PKCE',scannedFiles:files.length,artifactFingerprint:createHash('sha256').update(JSON.stringify(hashes.sort())).digest('hex'),secretScan:'passed',supabaseRuntimeVerification:'separate blocked-network browser test required'};
}
