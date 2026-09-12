import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { emergencyNotices } from '../tests/fixtures/emergency-notices.mjs';

export function publicEmergencyRow(row) {
  if (row.is_private !== false || row.admin_status !== 'published' || row.admin_deleted_at !== null) return null;
  if (typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,180}$/.test(row.id)) throw new Error('INVALID_PUBLIC_ID');
  const result = {};
  for (const key of ['id','schoolName','departmentName','projectName','projectType','discipline','publishDate','deadlineDate','sourceLink','requirements']) {
    result[key] = typeof row[key] === 'string' ? row[key] : '';
    if (result[key].length > (key === 'requirements' ? 200_000 : 1000)) throw new Error('PUBLIC_FIELD_TOO_LARGE');
  }
  try { if (!['https:', 'http:'].includes(new URL(result.sourceLink).protocol)) result.sourceLink = ''; }
  catch { result.sourceLink = ''; }
  result.tags = Array.isArray(row.tags) ? row.tags.filter(x => typeof x === 'string').slice(0, 20).map(x => x.slice(0, 40)) : [];
  return result;
}

export async function buildEmergency({ snapshot, outDir, fixture = false }) {
  if (snapshot.sourceProjectRef !== 'mnotoltpythkayguhnrk') throw new Error('WRONG_SOURCE_PROJECT');
  if (!snapshot.version || !Number.isFinite(Date.parse(snapshot.reviewedAt)) || !Number.isFinite(Date.parse(snapshot.expiresAt))) throw new Error('REVIEW_PROVENANCE_REQUIRED');
  if (Date.parse(snapshot.expiresAt) <= Date.now() || Date.parse(snapshot.expiresAt) - Date.parse(snapshot.reviewedAt) > 24*60*60*1000) throw new Error('SNAPSHOT_EXPIRED_OR_TOO_LONG');
  if (!Array.isArray(snapshot.notices)) throw new Error('NOTICES_REQUIRED');
  const rows = snapshot.notices.map(publicEmergencyRow).filter(Boolean);
  if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('DUPLICATE_ID');
  if (rows.length * 2 + 10 > 20_000) throw new Error('FREE_STATIC_FILE_LIMIT');
  // New directory only: no stale detail files from an earlier public generation.
  await mkdir(outDir, { recursive: false });
  await mkdir(join(outDir, 'data'));
  const metadata = { version: snapshot.version, reviewedAt: snapshot.reviewedAt, expiresAt: snapshot.expiresAt, count: rows.length, fixture };
  const index = rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'requirements')));
  await writeFile(join(outDir, 'data/index.json'), JSON.stringify({ ...metadata, items: index }));
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'"><title>寻鹿 SeekOffer · 应急只读</title><link rel="stylesheet" href="/style.css"><header><a href="/">寻鹿 SeekOffer</a><strong>应急只读</strong></header><main><h1>公开通知</h1><p id="status" role="status">正在读取公开快照</p><p>登录、注册、云同步与新购买暂不在本应急站提供。请保留原浏览器中的本地数据。</p><section id="controls"><label>搜索 <input id="search" maxlength="80"></label><label>地区 <select id="region"><option value="">全部</option></select></label><label>类型 <select id="type"><option value="">全部</option></select></label><label>排序 <select id="sort"><option value="publish">最新发布</option><option value="deadline">截止时间</option></select></label></section><div id="content"></div><nav><button id="prev">上一页</button><span id="page"></span><button id="next">下一页</button></nav></main><script src="/app.js" defer></script></html>`;
  await writeFile(join(outDir, 'index.html'), html);
  await mkdir(join(outDir, 'notices/detail'), { recursive: true });
  await writeFile(join(outDir, 'notices/detail/index.html'), html);
  await writeFile(join(outDir, 'notices/index.html'), html);
  for (const row of rows) {
    await writeFile(join(outDir, 'data', row.id + '.json'), JSON.stringify({ version: snapshot.version, item: row }));
    await mkdir(join(outDir, 'notices', row.id));
    await writeFile(join(outDir, 'notices', row.id, 'index.html'), html);
  }
  await writeFile(join(outDir, 'style.css'), '[hidden]{display:none!important}body{margin:0;background:#f7faf9;color:#243c35;font:16px/1.8 system-ui,sans-serif}header{display:flex;justify-content:space-between;background:white;padding:20px max(20px,calc((100% - 1100px)/2));border-bottom:1px solid #dce8e1}main{max-width:1100px;margin:30px auto;padding:0 20px}a{color:#177f5e}section,nav{display:flex;gap:15px;flex-wrap:wrap;margin:20px 0}input,select,button{font:inherit;padding:8px;border:1px solid #c5d8cb;border-radius:8px;background:white}article{background:white;border:1px solid #dce8e1;border-radius:14px;padding:20px;margin:14px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}#status{background:#fff1cc;padding:12px;border-radius:8px}button{cursor:pointer}button:disabled{opacity:.5}');
  await writeFile(join(outDir, 'app.js'), await readFile(new URL('./readonly-emergency-client.js', import.meta.url)));
  await writeFile(join(outDir, '_headers'), '/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n');
  const files = [];
  async function inventory(dir) { for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, file.name); if (file.isDirectory()) await inventory(path); else {
      const bytes = (await stat(path)).size; if (bytes > 25*1024*1024) throw new Error('FREE_STATIC_ASSET_SIZE_LIMIT');
      files.push({ path: path.slice(outDir.length + 1).replaceAll('\\','/'), bytes, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
    }
  } }
  await inventory(outDir);
  const manifest = { ...metadata, deployable: !fixture, sourceProjectRef: snapshot.sourceProjectRef, files, totalBytes: files.reduce((sum,f)=>sum+f.bytes,0), backupRestoreTest: 'not_performed' };
  await writeFile(outDir + '.manifest.json', JSON.stringify(manifest, null, 2));
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const fixture = process.argv.includes('--fixture');
  const input = process.argv.indexOf('--input');
  const output = process.argv.indexOf('--out');
  if (output < 0 || (!fixture && input < 0)) throw new Error('Use --fixture or --input reviewed-snapshot.json and --out NEW_DIRECTORY');
  const snapshot = fixture ? { sourceProjectRef: 'mnotoltpythkayguhnrk', version: 'offline-fixture-v1', reviewedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+3600_000).toISOString(), notices: emergencyNotices().map(row=>({...row,is_private:false,admin_status:'published',admin_deleted_at:null})) } : JSON.parse(await readFile(process.argv[input+1], 'utf8'));
  const result = await buildEmergency({snapshot,outDir:resolve(process.argv[output+1]),fixture});
  console.log(JSON.stringify({ fixture, count: result.count, files: result.files.length, bytes: result.totalBytes, deployable: result.deployable }));
}
